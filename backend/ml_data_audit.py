"""
Phase 0: Data Audit Script
Checks analyzed_emails for class balance, row counts, and label quality.
"""
from database import _get_connection, _release_connection, _execute

def audit_data():
    conn = _get_connection()
    try:
        cur = conn.cursor()
        
        print("=" * 60)
        print("ML PIPELINE DATA AUDIT - Phase 0")
        print("=" * 60)
        
        _execute(cur, "SELECT COUNT(*) as total FROM analyzed_emails")
        total = cur.fetchone()[0]
        print(f"\nTotal analyzed emails: {total}")
        
        _execute(cur, """
            SELECT label_id, COUNT(*) as count 
            FROM analyzed_emails 
            GROUP BY label_id 
            ORDER BY count DESC
        """)
        print("\nLabel distribution:")
        for row in cur.fetchall():
            label = row[0] if row[0] else "NULL"
            count = row[1]
            pct = (count / total * 100) if total > 0 else 0
            print(f"  Label {label}: {count} rows ({pct:.1f}%)")
        
        _execute(cur, """
            SELECT 
                CASE 
                    WHEN scam_score < 0.3 THEN 'low (0-0.3)'
                    WHEN scam_score < 0.6 THEN 'medium (0.3-0.6)'
                    ELSE 'high (0.6-1.0)'
                END as risk_bucket,
                COUNT(*) as count
            FROM analyzed_emails
            WHERE scam_score IS NOT NULL
            GROUP BY risk_bucket
            ORDER BY risk_bucket
        """)
        print("\nScam score distribution:")
        for row in cur.fetchall():
            print(f"  {row[0]}: {row[1]} rows")
        
        _execute(cur, """
            SELECT COUNT(*) 
            FROM analyzed_emails 
            WHERE label_id IS NOT NULL AND scam_score IS NOT NULL
        """)
        labeled_count = cur.fetchone()[0]
        print(f"\nRows with both label_id and scam_score: {labeled_count}")
        
        print("\n" + "=" * 60)
        print("ASSESSMENT:")
        if total < 500:
            print("INSUFFICIENT DATA: Need at least 500 rows total")
            print("   Recommendation: Keep AI cascade running, delay ML implementation")
        elif labeled_count < 300:
            print(f"LIMITED LABELED DATA: Only {labeled_count} fully labeled rows")
            print("   Recommendation: Run in shadow mode only (Phase 5)")
        else:
            print("OK - Sufficient data for initial training")
            print("  Proceed with Phase 1 (schema changes)")
        print("=" * 60)
        
    finally:
        _release_connection(conn)

if __name__ == "__main__":
    audit_data()
