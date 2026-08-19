"""
Phase 9: ML Pipeline Monitoring Script
Tracks ML/AI agreement rate, drift detection, and model health.
"""
from datetime import datetime, timedelta
from database import _get_connection, _release_connection, _execute
from ml_inference import get_disagreement_rate


def monitor_ml_pipeline():
    """Generate ML pipeline health report."""
    conn = _get_connection()
    try:
        cursor = conn.cursor()
        
        print("="*80)
        print("ML PIPELINE MONITORING REPORT")
        print(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("="*80)
        
        # Active model info
        _execute(cursor, """
            SELECT version, trained_at, training_row_count, 
                   validation_precision, validation_recall, calibration_error
            FROM ml_models
            WHERE is_active = 1
        """)
        model_row = cursor.fetchone()
        
        if not model_row:
            print("\n⚠ NO ACTIVE MODEL")
            print("  Status: Running in AI-only mode")
            print("  Action: Train and activate a model with train_ml_model.py + activate_model.py")
            return
        
        version = model_row[0] if isinstance(model_row, tuple) else model_row['version']
        trained_at = model_row[1] if isinstance(model_row, tuple) else model_row['trained_at']
        row_count = model_row[2] if isinstance(model_row, tuple) else model_row['training_row_count']
        precision = model_row[3] if isinstance(model_row, tuple) else model_row['validation_precision']
        recall = model_row[4] if isinstance(model_row, tuple) else model_row['validation_recall']
        cal_err = model_row[5] if isinstance(model_row, tuple) else model_row['calibration_error']
        
        print("\n[ACTIVE MODEL]")
        print(f"  Version: {version}")
        print(f"  Trained: {trained_at}")
        print(f"  Training rows: {row_count}")
        print(f"  Validation precision: {precision:.3f}")
        print(f"  Validation recall: {recall:.3f}")
        print(f"  Calibration error: {cal_err:.4f}")
        
        # Prediction distribution (last 7 days)
        _execute(cursor, """
            SELECT source, COUNT(*) as count
            FROM analyzed_emails
            WHERE analyzed_at >= datetime('now', '-7 days')
            GROUP BY source
        """)
        
        print("\n[PREDICTION SOURCES - Last 7 days]")
        source_counts = {}
        total = 0
        for row in cursor.fetchall():
            source = row[0] if isinstance(row, tuple) else row['source']
            count = row[1] if isinstance(row, tuple) else row['count']
            source_counts[source] = count
            total += count
        
        if total == 0:
            print("  No emails analyzed in last 7 days")
        else:
            for source in ['ml', 'ai', 'ml_audit_escalated']:
                count = source_counts.get(source, 0)
                pct = (count / total * 100) if total > 0 else 0
                print(f"  {source:20s}: {count:5d} ({pct:5.1f}%)")
        
        # Disagreement rate monitoring (drift detection)
        for days in [1, 7, 30]:
            rate = get_disagreement_rate(days)
            print(f"\n[DISAGREEMENT RATE - Last {days} days]")
            print(f"  Rate: {rate:.1%}")
            
            if rate > 0.25:
                print(f"  ⚠ WARNING: High disagreement rate (>{25:.0%})")
                print("  Action: Review recent disagreements and consider retraining")
            elif rate > 0.15:
                print(f"  ⚠ CAUTION: Elevated disagreement rate (>{15:.0%})")
                print("  Action: Monitor closely, retrain if trend continues")
            else:
                print("  ✓ Normal range")
        
        # Recent disagreements
        _execute(cursor, """
            SELECT 
                d.email_id, d.ml_prediction, d.ml_confidence, 
                d.ai_prediction, d.agreed, d.logged_at,
                e.subject
            FROM ml_disagreements d
            JOIN analyzed_emails e ON d.email_id = e.email_id
            WHERE d.logged_at >= datetime('now', '-3 days')
              AND d.agreed = 0
            ORDER BY d.logged_at DESC
            LIMIT 10
        """)
        
        disagreement_rows = cursor.fetchall()
        if disagreement_rows:
            print("\n[RECENT DISAGREEMENTS - Last 3 days]")
            print("  (Showing up to 10 most recent)")
            for row in disagreement_rows:
                email_id = (row[0] if isinstance(row, tuple) else row['email_id'])[:12]
                ml_pred = row[1] if isinstance(row, tuple) else row['ml_prediction']
                ml_conf = row[2] if isinstance(row, tuple) else row['ml_confidence']
                ai_pred = row[3] if isinstance(row, tuple) else row['ai_prediction']
                logged_at = row[5] if isinstance(row, tuple) else row['logged_at']
                subject = (row[6] if isinstance(row, tuple) else row['subject'])[:40]
                
                print(f"\n  Email: {email_id}... | {logged_at}")
                print(f"    Subject: {subject}")
                print(f"    ML: {ml_pred} (conf={ml_conf:.3f})")
                print(f"    AI: {ai_pred}")
        
        # ML confidence distribution
        _execute(cursor, """
            SELECT 
                CASE 
                    WHEN ml_confidence >= 0.95 THEN 'very_high (0.95+)'
                    WHEN ml_confidence >= 0.85 THEN 'high (0.85-0.95)'
                    WHEN ml_confidence >= 0.70 THEN 'medium (0.70-0.85)'
                    ELSE 'low (<0.70)'
                END as conf_bucket,
                COUNT(*) as count
            FROM analyzed_emails
            WHERE source = 'ml' 
              AND ml_confidence IS NOT NULL
              AND analyzed_at >= datetime('now', '-7 days')
            GROUP BY conf_bucket
        """)
        
        print("\n[ML CONFIDENCE DISTRIBUTION - Last 7 days]")
        for row in cursor.fetchall():
            bucket = row[0] if isinstance(row, tuple) else row['conf_bucket']
            count = row[1] if isinstance(row, tuple) else row['count']
            print(f"  {bucket:25s}: {count:5d}")
        
        print("\n" + "="*80)
        print("Report complete")
        print("="*80)
        
    finally:
        _release_connection(conn)


if __name__ == "__main__":
    monitor_ml_pipeline()
