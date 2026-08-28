"""
Phase 6: ML Inference Module
Loads trained model at startup and provides prediction API.
Designed for async FastAPI integration with asyncio.to_thread wrapping.
Deployment: 2026-08-20 03:38 UTC - ML model v20260820_001758 active
"""

from logger_setup import get_logger
logger = get_logger(__name__)

import pickle
import asyncio
from typing import Dict, Any, Optional, Tuple
from database import _get_connection, _release_connection, _execute
from features import extract_features, get_sender_history


_MODEL_CACHE = None
_MODEL_VERSION = None


def load_active_model():
    """
    Load the active ML model from database at startup.
    Returns None if no active model exists (insufficient data scenario).
    """
    global _MODEL_CACHE, _MODEL_VERSION
    
    conn = _get_connection()
    try:
        cursor = conn.cursor()
        _execute(cursor, """
            SELECT version, model_blob, validation_recall
            FROM ml_models
            WHERE is_active = 1
            ORDER BY trained_at DESC
            LIMIT 1
        """)
        
        row = cursor.fetchone()
        if not row:
            logger.info("[ML] No active model found. Running AI-only mode.")
            return None
        
        version = row[0] if isinstance(row, tuple) else row['version']
        model_blob = row[1] if isinstance(row, tuple) else row['model_blob']
        recall = row[2] if isinstance(row, tuple) else row['validation_recall']
        
        _MODEL_CACHE = pickle.loads(model_blob)
        _MODEL_VERSION = version
        
        logger.info(f"[ML] Loaded model version {version} (recall={recall:.3f})")
        return _MODEL_CACHE
        
    except Exception as e:
        logger.info(f"[ML] Failed to load model: {e}")
        return None
    finally:
        _release_connection(conn)


def is_model_available() -> bool:
    """Check if ML model is loaded and ready."""
    return _MODEL_CACHE is not None


async def predict_async(
    email_id: str,
    subject: str,
    sender: str,
    body: str,
    snippet: str = None,
    user_id: int = None
) -> Optional[Dict[str, Any]]:
    """
    Async wrapper for ML prediction.
    Runs synchronous sklearn inference in thread pool to avoid blocking event loop.
    
    Returns:
        Dict with {prediction, confidence, should_escalate_to_ai} or None if no model
    """
    if not is_model_available():
        return None
    
    result = await asyncio.to_thread(
        _predict_sync,
        email_id, subject, sender, body, snippet, user_id
    )
    
    return result


def _predict_sync(
    email_id: str,
    subject: str,
    sender: str,
    body: str,
    snippet: str,
    user_id: int
) -> Dict[str, Any]:
    """
    Synchronous prediction (called in thread pool).
    
    Phase 6 routing logic:
    1. Structural risk signals present → always escalate to AI
    2. ML confident (≥ threshold) → use ML result
    3. Random audit sample (3-5%) → escalate even if confident
    4. Otherwise → escalate to AI
    """
    import random
    
    STRICT_CONFIDENCE_THRESHOLD = 0.85
    AUDIT_SAMPLE_RATE = 0.04
    
    conn = _get_connection()
    try:
        sender_hist = get_sender_history(sender, conn)
        
        features = extract_features(
            subject=subject,
            sender=sender,
            body=body,
            snippet=snippet,
            sender_history=sender_hist
        )
        
        if _has_structural_risk_signals(features):
            return {
                'prediction': None,
                'confidence': 0.0,
                'should_escalate_to_ai': True,
                'reason': 'structural_risk'
            }
        
        model_package = _MODEL_CACHE
        tfidf = model_package['tfidf']
        classifier = model_package['classifier']
        feature_names = model_package['feature_names']
        
        text = f"{subject} {body}"
        text_features = tfidf.transform([text])
        
        import pandas as pd
        from scipy.sparse import hstack
        
        struct_features = pd.DataFrame([features])[feature_names].fillna(0).values
        X_combined = hstack([text_features, struct_features])
        
        prediction = classifier.predict(X_combined)[0]
        proba = classifier.predict_proba(X_combined)[0]
        
        class_idx = {cls: i for i, cls in enumerate(classifier.classes_)}
        confidence = max(proba)
        
        is_audit_sample = random.random() < AUDIT_SAMPLE_RATE
        
        if is_audit_sample:
            return {
                'prediction': prediction,
                'confidence': float(confidence),
                'should_escalate_to_ai': True,
                'reason': 'audit_sample'
            }
        
        should_escalate = confidence < STRICT_CONFIDENCE_THRESHOLD
        
        return {
            'prediction': prediction,
            'confidence': float(confidence),
            'should_escalate_to_ai': should_escalate,
            'reason': 'low_confidence' if should_escalate else 'confident'
        }
        
    finally:
        _release_connection(conn)


def _has_structural_risk_signals(features: Dict[str, Any]) -> bool:
    """
    Check for structural risk signals that always trigger AI escalation.
    
    Per risk E1: ML layer never auto-clears emails with these signals.
    Structural signals (SPF/DKIM/URLs) can't be spoofed by text alone.
    """
    if features.get('spf_pass', 1) == 0 or features.get('dkim_pass', 1) == 0:
        return True
    
    if features.get('sender_display_mismatch', 0) == 1:
        return True
    
    if features.get('url_count', 0) >= 3 and features.get('urgency_score', 0) > 0.4:
        return True
    
    if features.get('suspicious_tld', 0) == 1:
        return True
    
    return False


async def log_disagreement(
    email_id: str,
    ml_prediction: str,
    ml_confidence: float,
    ai_prediction: str
):
    """
    Log ML vs AI disagreement for drift detection.
    Called after AI cascade completes on an escalated email.
    """
    def _log_sync():
        conn = _get_connection()
        try:
            cursor = conn.cursor()
            
            ml_risk = 'high_risk' if ml_prediction == 'high_risk' else 'low_risk'
            
            agreed = 1 if ml_risk == ai_prediction else 0
            
            _execute(cursor, """
                INSERT INTO ml_disagreements (
                    email_id, ml_prediction, ml_confidence, 
                    ai_prediction, agreed
                ) VALUES (%s, %s, %s, %s, %s)
            """, (email_id, ml_prediction, ml_confidence, ai_prediction, agreed))
            
            conn.commit()
        finally:
            _release_connection(conn)
    
    await asyncio.to_thread(_log_sync)


def get_disagreement_rate(days: int = 7) -> float:
    """
    Get ML/AI disagreement rate over last N days.
    Used for drift detection monitoring.
    """
    conn = _get_connection()
    try:
        cursor = conn.cursor()
        
        if conn.__class__.__module__.startswith('psycopg'):
            interval_clause = f"logged_at >= NOW() - INTERVAL '{days} days'"
        else:
            interval_clause = f"logged_at >= datetime('now', '-{days} days')"
        
        _execute(cursor, f"""
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN agreed = 0 THEN 1 ELSE 0 END) as disagreed
            FROM ml_disagreements
            WHERE {interval_clause}
        """)
        
        row = cursor.fetchone()
        if row and row[0] > 0:
            total = row[0]
            disagreed = row[1] or 0
            return disagreed / total
        
        return 0.0
        
    finally:
        _release_connection(conn)
