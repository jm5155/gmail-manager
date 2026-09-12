"""
V2 ML Model Confidence-Band Routing Module
Routes emails through V2 → AI cascade based on confidence bands

Routing logic:
  Score < 0.40  → Auto-clear (legitimate, fast path)
  Score 0.40-0.85 → Route to AI cascade for final verdict
  Score > 0.85  → Auto-flag (high-confidence phishing)

Thresholds are configurable via environment variables.
"""

from logger_setup import get_logger
logger = get_logger(__name__)

import os
import asyncio
from typing import Dict, Any, Optional
from datetime import datetime

# Configurable thresholds (validated in validate_routing_bands_simple.py)
AUTO_CLEAR_THRESHOLD = float(os.getenv("V2_AUTO_CLEAR_THRESHOLD", "0.40"))
AUTO_FLAG_THRESHOLD = float(os.getenv("V2_AUTO_FLAG_THRESHOLD", "0.85"))

# Import V2 prediction module
try:
    from predict import predict_email
    V2_AVAILABLE = True
    logger.info(f"[V2_ROUTER] Model loaded. Thresholds: auto-clear<{AUTO_CLEAR_THRESHOLD}, auto-flag>{AUTO_FLAG_THRESHOLD}")
except Exception as e:
    V2_AVAILABLE = False
    logger.warning(f"[V2_ROUTER] V2 model unavailable: {e}. Falling back to AI cascade for all emails.")


async def route_email_with_v2(
    email_id: str,
    subject: str,
    sender: str,
    body: str,
    snippet: str,
    ai_cascade_func,  # Function to call AI cascade: async (prompt) -> ai_result
    classification_prompt: str,
    url_threat_confirmed: bool = False,
    url_scan_unavailable: bool = False,
    available_label_names: list = None
) -> Dict[str, Any]:
    """
    Route email through V2 confidence-band system.
    
    Returns dict with:
        - label: str
        - scam_score: int (0-100)
        - scam_indicators: list[str]
        - routing_decision: str ('v2_auto_clear', 'v2_auto_flag', 'ai_cascade', 'v2_unavailable')
        - v2_score: float (phishing probability, 0-1)
        - provider_used: str (which provider answered, if AI cascade)
    """
    
    # Default response structure
    response = {
        'label': (available_label_names[0] if available_label_names else 'Unknown'),
        'scam_score': 50,  # Neutral default
        'scam_indicators': [],
        'reasoning': '',
        'routing_decision': 'v2_unavailable',
        'v2_score': None,
        'provider_used': None,
    }
    
    # If V2 unavailable, fall back to AI cascade
    if not V2_AVAILABLE:
        logger.info(f"[V2_ROUTER] {email_id[:12]}... V2 unavailable, routing to AI cascade")
        ai_result = await ai_cascade_func()
        
        if ai_result.get('data'):
            data = ai_result['data']
            response.update({
                'label': data.get('label', response['label']),
                'scam_score': data.get('scam_score', 50),
                'scam_indicators': data.get('scam_indicators', []),
                'reasoning': data.get('reasoning', ''),
                'routing_decision': 'v2_unavailable',
                'provider_used': ai_result.get('provider_used', 'unknown'),
            })
        
        return response
    
    # Step 1: Run V2 prediction (fast, local, no API cost)
    try:
        v2_result = await asyncio.to_thread(
            predict_email,
            subject,
            body,
            sender
        )
        
        v2_score = v2_result['probabilities']['phishing']
        response['v2_score'] = v2_score
        
        logger.info(f"[V2_ROUTER] {email_id[:12]}... V2 score: {v2_score:.4f}")
        
    except Exception as e:
        logger.error(f"[V2_ROUTER] {email_id[:12]}... V2 prediction failed: {e}", exc_info=True)
        # Fall back to AI cascade
        ai_result = await ai_cascade_func()
        
        if ai_result.get('data'):
            data = ai_result['data']
            response.update({
                'label': data.get('label', response['label']),
                'scam_score': data.get('scam_score', 50),
                'scam_indicators': data.get('scam_indicators', []),
                'reasoning': data.get('reasoning', ''),
                'routing_decision': 'v2_error_fallback',
                'provider_used': ai_result.get('provider_used', 'unknown'),
            })
        
        return response
    
    # Step 2: Route based on confidence band
    
    # Band 1: Auto-clear (< 0.40) - High confidence legitimate
    if v2_score < AUTO_CLEAR_THRESHOLD:
        logger.info(f"[V2_ROUTER] {email_id[:12]}... AUTO-CLEAR (score={v2_score:.4f} < {AUTO_CLEAR_THRESHOLD})")
        
        response.update({
            'label': available_label_names[0] if available_label_names else 'Safe',
            'scam_score': int(v2_score * 100),
            'scam_indicators': [],
            'reasoning': f'V2 ML model classified as legitimate (confidence: {(1-v2_score)*100:.1f}%)',
            'routing_decision': 'v2_auto_clear',
        })
        
        return response
    
    # Band 3: Auto-flag (> 0.85) - High confidence phishing
    elif v2_score > AUTO_FLAG_THRESHOLD:
        logger.info(f"[V2_ROUTER] {email_id[:12]}... AUTO-FLAG (score={v2_score:.4f} > {AUTO_FLAG_THRESHOLD})")
        
        response.update({
            'label': 'Spam',
            'scam_score': int(v2_score * 100),
            'scam_indicators': [
                f'V2 ML model classified as phishing (confidence: {v2_score*100:.1f}%)',
                'High-confidence automatic detection'
            ],
            'reasoning': f'V2 ML model detected phishing patterns with {v2_score*100:.1f}% confidence',
            'routing_decision': 'v2_auto_flag',
        })
        
        return response
    
    # Band 2: AI Cascade (0.40 - 0.85) - Uncertain, needs human-like judgment
    else:
        logger.info(f"[V2_ROUTER] {email_id[:12]}... ROUTING TO AI CASCADE (score={v2_score:.4f} in uncertain band)")
        
        # Call AI cascade for final verdict
        ai_result = await ai_cascade_func()
        
        if ai_result.get('data'):
            data = ai_result['data']
            response.update({
                'label': data.get('label', response['label']),
                'scam_score': data.get('scam_score', 50),
                'scam_indicators': data.get('scam_indicators', []),
                'reasoning': data.get('reasoning', ''),
                'routing_decision': 'ai_cascade',
                'provider_used': ai_result.get('provider_used', 'unknown'),
            })
            
            # Log V2 vs AI comparison for monitoring
            v2_risk = 'high' if v2_score >= 0.60 else 'medium' if v2_score >= 0.50 else 'low'
            ai_risk = 'high' if response['scam_score'] >= 60 else 'low'
            
            if (v2_risk == 'high' and ai_risk == 'low') or (v2_risk == 'low' and ai_risk == 'high'):
                logger.info(f"[V2_ROUTER] {email_id[:12]}... DISAGREEMENT: V2={v2_score:.2f} ({v2_risk}), AI={response['scam_score']} ({ai_risk})")
        
        else:
            # AI cascade failed, use V2 as fallback
            logger.warning(f"[V2_ROUTER] {email_id[:12]}... AI cascade failed, using V2 prediction")
            
            response.update({
                'label': 'Spam' if v2_score >= 0.60 else (available_label_names[0] if available_label_names else 'Safe'),
                'scam_score': int(v2_score * 100),
                'scam_indicators': [f'V2 ML model score: {v2_score*100:.0f}%'],
                'reasoning': f'AI cascade unavailable, V2 model prediction used (score: {v2_score:.2f})',
                'routing_decision': 'ai_cascade_failed_v2_fallback',
            })
        
        return response


def get_routing_stats() -> Dict[str, Any]:
    """
    Get current routing configuration and statistics.
    For monitoring/debugging.
    """
    return {
        'v2_available': V2_AVAILABLE,
        'auto_clear_threshold': AUTO_CLEAR_THRESHOLD,
        'auto_flag_threshold': AUTO_FLAG_THRESHOLD,
        'cascade_band': f'{AUTO_CLEAR_THRESHOLD}-{AUTO_FLAG_THRESHOLD}',
    }
