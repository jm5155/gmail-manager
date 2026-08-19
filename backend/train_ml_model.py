"""
Phase 3: Offline Training + Calibration Script
Trains the local ML model on historical analyzed_emails data.
Run manually/offline - not wired into live app initially.
"""
import json
import pickle
from datetime import datetime
from typing import Tuple, Dict, Any
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.calibration import CalibratedClassifierCV
from sklearn.model_selection import train_test_split
from sklearn.metrics import precision_recall_fscore_support, confusion_matrix
from database import _get_connection, _release_connection, _execute
from features import extract_features, get_sender_history


MIN_TRAINING_ROWS = 500
MIN_ROWS_PER_CLASS = 50


def load_training_data():
    """Load and prepare training data from analyzed_emails."""
    conn = _get_connection()
    try:
        cursor = conn.cursor()
        
        _execute(cursor, """
            SELECT 
                email_id, subject, sender, body, snippet, 
                label_id, scam_score, provider_used
            FROM analyzed_emails
            WHERE label_id IS NOT NULL 
              AND scam_score IS NOT NULL
              AND source = 'ai'
            ORDER BY analyzed_at DESC
        """)
        
        rows = cursor.fetchall()
        print(f"Loaded {len(rows)} training samples")
        
        if len(rows) < MIN_TRAINING_ROWS:
            raise ValueError(
                f"Insufficient training data: {len(rows)} rows (need {MIN_TRAINING_ROWS}+). "
                f"Run AI cascade longer before training ML model."
            )
        
        X_features = []
        X_text = []
        y_labels = []
        y_scores = []
        providers = []
        
        for row in rows:
            sender_hist = get_sender_history(row['sender'] if isinstance(row, dict) else row[2], conn)
            
            features = extract_features(
                subject=row['subject'] if isinstance(row, dict) else row[1],
                sender=row['sender'] if isinstance(row, dict) else row[2],
                body=row['body'] if isinstance(row, dict) else row[3],
                snippet=row['snippet'] if isinstance(row, dict) else row[4],
                sender_history=sender_hist
            )
            
            X_features.append(features)
            text = f"{row['subject'] if isinstance(row, dict) else row[1]} {row['body'] if isinstance(row, dict) else row[3]}"
            X_text.append(text)
            
            score = row['scam_score'] if isinstance(row, dict) else row[6]
            y_labels.append('high_risk' if score >= 0.6 else 'low_risk')
            y_scores.append(score)
            providers.append(row['provider_used'] if isinstance(row, dict) else row[7])
        
        return X_features, X_text, y_labels, y_scores, providers
    
    finally:
        _release_connection(conn)


def train_model(X_features, X_text, y_labels, min_rows_per_class=MIN_ROWS_PER_CLASS):
    """
    Train calibrated classifier on features + text.
    
    Returns:
        Tuple of (trained_model, tfidf_vectorizer, metrics_dict)
    """
    from collections import Counter
    
    class_counts = Counter(y_labels)
    print(f"Class distribution: {dict(class_counts)}")
    
    for label, count in class_counts.items():
        if count < min_rows_per_class:
            raise ValueError(
                f"Class '{label}' has only {count} samples (need {min_rows_per_class}+). "
                f"Collect more data before training."
            )
    
    train_feat, val_feat, train_text, val_text, y_train, y_val = train_test_split(
        X_features, X_text, y_labels, 
        test_size=0.30, 
        stratify=y_labels,
        random_state=42
    )
    
    cal_feat, test_feat, cal_text, test_text, y_cal, y_test = train_test_split(
        val_feat, val_text, y_val,
        test_size=0.50,
        stratify=y_val,
        random_state=42
    )
    
    print(f"Split: {len(y_train)} train, {len(y_cal)} calibration, {len(y_test)} validation")
    
    tfidf = TfidfVectorizer(max_features=500, ngram_range=(1, 2), min_df=2)
    train_text_features = tfidf.fit_transform(train_text)
    cal_text_features = tfidf.transform(cal_text)
    test_text_features = tfidf.transform(test_text)
    
    from scipy.sparse import hstack
    import pandas as pd
    
    train_struct = pd.DataFrame(train_feat).fillna(0).values
    cal_struct = pd.DataFrame(cal_feat).fillna(0).values
    test_struct = pd.DataFrame(test_feat).fillna(0).values
    
    X_train_combined = hstack([train_text_features, train_struct])
    X_cal_combined = hstack([cal_text_features, cal_struct])
    X_test_combined = hstack([test_text_features, test_struct])
    
    base_clf = LogisticRegression(
        max_iter=1000, 
        class_weight='balanced',
        random_state=42
    )
    
    print("Training base classifier...")
    base_clf.fit(X_train_combined, y_train)
    
    print("Calibrating with isotonic regression...")
    calibrated_clf = CalibratedClassifierCV(
        base_clf, 
        method='isotonic',
        cv='prefit'
    )
    calibrated_clf.fit(X_cal_combined, y_cal)
    
    y_pred = calibrated_clf.predict(X_test_combined)
    y_proba = calibrated_clf.predict_proba(X_test_combined)
    
    precision, recall, f1, support = precision_recall_fscore_support(
        y_test, y_pred, 
        average=None,
        labels=['low_risk', 'high_risk']
    )
    
    cm = confusion_matrix(y_test, y_pred, labels=['low_risk', 'high_risk'])
    
    ece = _compute_expected_calibration_error(y_test, y_proba, calibrated_clf.classes_)
    
    metrics = {
        'precision_low_risk': float(precision[0]),
        'recall_low_risk': float(recall[0]),
        'f1_low_risk': float(f1[0]),
        'precision_high_risk': float(precision[1]),
        'recall_high_risk': float(recall[1]),
        'f1_high_risk': float(f1[1]),
        'confusion_matrix': cm.tolist(),
        'calibration_error': float(ece),
        'support': support.tolist()
    }
    
    print("\n" + "="*60)
    print("VALIDATION METRICS:")
    print("="*60)
    print(f"Low-risk:  Precision={metrics['precision_low_risk']:.3f}, Recall={metrics['recall_low_risk']:.3f}")
    print(f"High-risk: Precision={metrics['precision_high_risk']:.3f}, Recall={metrics['recall_high_risk']:.3f}")
    print(f"Calibration Error: {metrics['calibration_error']:.4f}")
    print(f"Confusion Matrix:\n{cm}")
    print("="*60)
    
    MIN_RECALL_HIGH_RISK = 0.90
    if metrics['recall_high_risk'] < MIN_RECALL_HIGH_RISK:
        raise ValueError(
            f"Model fails minimum bar: high-risk recall {metrics['recall_high_risk']:.3f} "
            f"< {MIN_RECALL_HIGH_RISK}. Need more data or better features."
        )
    
    model_package = {
        'classifier': calibrated_clf,
        'tfidf': tfidf,
        'feature_names': list(train_feat[0].keys()),
        'classes': calibrated_clf.classes_.tolist()
    }
    
    return model_package, metrics


def _compute_expected_calibration_error(y_true, y_proba, classes, n_bins=10):
    """Compute Expected Calibration Error (ECE)."""
    import numpy as np
    
    class_idx = {cls: i for i, cls in enumerate(classes)}
    y_true_binary = np.array([1 if y == 'high_risk' else 0 for y in y_true])
    
    if 'high_risk' in class_idx:
        confidences = y_proba[:, class_idx['high_risk']]
    else:
        confidences = y_proba[:, 0]
    
    bin_boundaries = np.linspace(0, 1, n_bins + 1)
    ece = 0.0
    
    for i in range(n_bins):
        bin_lower, bin_upper = bin_boundaries[i], bin_boundaries[i + 1]
        in_bin = (confidences > bin_lower) & (confidences <= bin_upper)
        
        if in_bin.sum() > 0:
            bin_accuracy = y_true_binary[in_bin].mean()
            bin_confidence = confidences[in_bin].mean()
            ece += (in_bin.sum() / len(y_true)) * abs(bin_confidence - bin_accuracy)
    
    return ece


def save_model_to_db(model_package, metrics, training_row_count):
    """Save trained model to ml_models table."""
    conn = _get_connection()
    try:
        cursor = conn.cursor()
        
        model_blob = pickle.dumps(model_package)
        version = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        _execute(cursor, """
            INSERT INTO ml_models (
                version, training_row_count, validation_precision, 
                validation_recall, calibration_error, model_blob, is_active
            ) VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            version,
            training_row_count,
            metrics['precision_high_risk'],
            metrics['recall_high_risk'],
            metrics['calibration_error'],
            model_blob,
            0
        ))
        
        conn.commit()
        print(f"\nModel saved to database (version {version}, is_active=0)")
        print("Run activate_model.py to make it live")
        
    finally:
        _release_connection(conn)


def main():
    """Main training pipeline."""
    print("="*60)
    print("ML MODEL TRAINING - Phase 3")
    print("="*60)
    
    try:
        X_features, X_text, y_labels, y_scores, providers = load_training_data()
        
        model_package, metrics = train_model(X_features, X_text, y_labels)
        
        save_model_to_db(model_package, metrics, len(y_labels))
        
        print("\n✓ Training complete. Model ready for activation.")
        
    except ValueError as e:
        print(f"\n✗ Training aborted: {e}")
        return 1
    except Exception as e:
        print(f"\n✗ Training failed: {e}")
        raise
    
    return 0


if __name__ == "__main__":
    exit(main())
