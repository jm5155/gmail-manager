#!/usr/bin/env python3
"""
Script to replace SQLite ? placeholders with Postgres %s placeholders in database.py
Also fixes INSERT OR REPLACE to use Postgres ON CONFLICT syntax
"""

import re

def fix_placeholders(content):
    """Replace ? with %s in SQL queries"""
    # Replace ? with %s (simple global replacement)
    # This works because ? is only used as SQL placeholder in this file
    content = content.replace('?', '%s')
    return content

def fix_insert_or_replace(content):
    """Replace INSERT OR REPLACE with Postgres ON CONFLICT syntax"""
    
    # Find the INSERT OR REPLACE statement for analyzed_emails
    old_pattern = r'''INSERT OR REPLACE INTO analyzed_emails
            \(email_id, user_id, label_id, scam_score, scam_indicators, is_quarantined, snippet, sender, subject, status, body\)
            VALUES \(%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s\)'''
    
    new_statement = '''INSERT INTO analyzed_emails
            (email_id, user_id, label_id, scam_score, scam_indicators, is_quarantined, snippet, sender, subject, status, body)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (email_id) DO UPDATE SET
                user_id = EXCLUDED.user_id,
                label_id = EXCLUDED.label_id,
                scam_score = EXCLUDED.scam_score,
                scam_indicators = EXCLUDED.scam_indicators,
                is_quarantined = EXCLUDED.is_quarantined,
                snippet = EXCLUDED.snippet,
                sender = EXCLUDED.sender,
                subject = EXCLUDED.subject,
                status = EXCLUDED.status,
                body = EXCLUDED.body'''
    
    # Use a more flexible pattern to match the statement
    content = re.sub(
        r'INSERT OR REPLACE INTO analyzed_emails\s*\([^)]+\)\s*VALUES\s*\([^)]+\)',
        new_statement,
        content,
        flags=re.MULTILINE | re.DOTALL
    )
    
    return content

def main():
    print("=" * 60)
    print("Fixing database.py for Postgres Compatibility")
    print("=" * 60)
    
    # Read the file
    print("\n[1/4] Reading database.py...")
    with open('database.py', 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_length = len(content)
    question_marks = content.count('?')
    print(f"      File size: {original_length} bytes")
    print(f"      Found {question_marks} question marks to replace")
    
    # Fix placeholders
    print("\n[2/4] Replacing ? with %s...")
    content = fix_placeholders(content)
    new_question_marks = content.count('?')
    percent_s_count = content.count('%s')
    print(f"      Remaining ?: {new_question_marks}")
    print(f"      Now have: {percent_s_count} instances of %s")
    
    # Fix INSERT OR REPLACE
    print("\n[3/4] Converting INSERT OR REPLACE to ON CONFLICT...")
    if 'INSERT OR REPLACE' in content:
        content = fix_insert_or_replace(content)
        if 'ON CONFLICT (email_id) DO UPDATE' in content:
            print("      ✅ Successfully converted to ON CONFLICT syntax")
        else:
            print("      ⚠️  Pattern match may have failed, manual review needed")
    else:
        print("      ℹ️  No INSERT OR REPLACE found (may already be fixed)")
    
    # Write back
    print("\n[4/4] Writing updated database.py...")
    with open('database.py', 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"      ✅ File updated successfully")
    print(f"\n{'=' * 60}")
    print("✅ Migration complete!")
    print("\nNext steps:")
    print("  1. Review database.py for any issues")
    print("  2. Test with: python -c 'import database; database.init_db()'")
    print("  3. If errors occur, restore from: database.py.backup_postgres_migration")
    print("=" * 60)

if __name__ == "__main__":
    main()
