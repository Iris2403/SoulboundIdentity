import React, { useState, useEffect } from 'react';
import { formatDate } from '../utils';
import { Card, Button, Input, Select, TextArea, Modal, LoadingSpinner } from './ui';
import { ZKPSection } from './zkp-section';

export function ReputationSection({
    reputation, reviews, reviewsWritten, loading, contracts, selectedToken,
    userTokens, showNotification, onReload, hasReviewedCache, setHasReviewedCache, MAX_SCORE
}) {
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [checkingReviewed, setCheckingReviewed] = useState(false);
    const [reviewData, setReviewData] = useState({
        targetTokenId: '',
        reviewerTokenId: '',
        score: '75',
        verified: false,
        comment: ''
    });

    useEffect(() => {
        if (reviewData.targetTokenId && reviewData.reviewerTokenId && contracts) {
            checkHasReviewed(reviewData.reviewerTokenId, reviewData.targetTokenId);
        }
    }, [reviewData.targetTokenId, reviewData.reviewerTokenId]);

    const checkHasReviewed = async (reviewerId, targetId) => {
        const cacheKey = `${reviewerId}-${targetId}`;
        if (hasReviewedCache[cacheKey] !== undefined) return;
        setCheckingReviewed(true);
        try {
            const hasReviewed = await contracts.social.hasReviewed(reviewerId, targetId);
            setHasReviewedCache(prev => ({ ...prev, [cacheKey]: hasReviewed }));
        } catch (error) {
            console.error('Error checking hasReviewed:', error);
        } finally {
            setCheckingReviewed(false);
        }
    };

    const handleSubmitReview = async () => {
        try {
            if (!reviewData.targetTokenId || !reviewData.reviewerTokenId) {
                showNotification('Please fill in all required fields', 'error');
                return;
            }
            const targetId = parseInt(reviewData.targetTokenId);
            const reviewerId = parseInt(reviewData.reviewerTokenId);
            if (targetId === reviewerId) { showNotification('You cannot review yourself!', 'error'); return; }
            const cacheKey = `${reviewerId}-${targetId}`;
            if (hasReviewedCache[cacheKey]) { showNotification('You have already reviewed this token!', 'error'); return; }
            try { await contracts.soulbound.ownerOf(targetId); } catch { showNotification(`Token #${targetId} does not exist!`, 'error'); return; }
            try {
                const owner = await contracts.soulbound.ownerOf(reviewerId);
                const myAddress = await contracts.soulbound.signer.getAddress();
                if (owner.toLowerCase() !== myAddress.toLowerCase()) { showNotification(`You don't own Token #${reviewerId}!`, 'error'); return; }
            } catch { showNotification(`Token #${reviewerId} does not exist!`, 'error'); return; }
            const score = parseInt(reviewData.score);
            if (score < 0 || score > MAX_SCORE) { showNotification(`Score must be between 0 and ${MAX_SCORE}!`, 'error'); return; }
            const tx = await contracts.social.submitReview(targetId, reviewerId, score, reviewData.verified, false, reviewData.comment);
            showNotification('Submitting review...', 'info');
            await tx.wait();
            const storedReviews = JSON.parse(localStorage.getItem(`reviews_written_${reviewerId}`) || '[]');
            storedReviews.push({ targetTokenId: targetId, timestamp: Date.now() });
            localStorage.setItem(`reviews_written_${reviewerId}`, JSON.stringify(storedReviews));
            setHasReviewedCache(prev => ({ ...prev, [cacheKey]: true }));
            showNotification('Review submitted successfully!', 'success');
            setShowReviewModal(false);
            setReviewData({ targetTokenId: '', reviewerTokenId: '', score: '75', verified: false, comment: '' });
            onReload();
        } catch (error) {
            console.error('Error submitting review:', error);
            if (error.message.includes('AlreadyReviewed')) {
                showNotification('You have already reviewed this token!', 'error');
            } else {
                showNotification(error.message || 'Failed to submit review', 'error');
            }
        }
    };

    const cacheKey = `${reviewData.reviewerTokenId}-${reviewData.targetTokenId}`;
    const alreadyReviewed = hasReviewedCache[cacheKey];
    const commentLength = reviewData.comment.length;
    const commentLimit = 500;

    return (
        <div className="reputation-section">
            {reputation && (
                <div className="reputation-summary">
                    <Card className="rep-card"><div className="rep-metric"><div className="rep-value">{reputation.averageScore}</div><div className="rep-label">Average Score</div></div></Card>
                    <Card className="rep-card"><div className="rep-metric"><div className="rep-value">{reputation.totalReviews}</div><div className="rep-label">Total Reviews</div></div></Card>
                    <Card className="rep-card"><div className="rep-metric"><div className="rep-value">{reputation.verifiedReviews}</div><div className="rep-label">Verified Reviews</div></div></Card>
                </div>
            )}

            <Card>
                <div className="section-header">
                    <h3>Reviews Received</h3>
                    <Button onClick={() => setShowReviewModal(true)}>Write Review</Button>
                </div>
                {loading ? <LoadingSpinner /> : reviews.length === 0 ? (
                    <div className="empty-message"><p>No reviews yet</p></div>
                ) : (
                    <div className="reviews-list">
                        {reviews.map((review, idx) => (
                            <div key={idx} className="review-item">
                                <div className="review-header">
                                    <div className="reviewer-info">
                                        <span>Token #{review.reviewerTokenId.toString()}</span>
                                        {review.verified && <span className="verified-badge">✓ Verified</span>}
                                    </div>
                                    <div className="review-score">{review.score}/{MAX_SCORE}</div>
                                </div>
                                {review.comment && review.comment.trim() !== '' && (
                                    <div style={{ background: 'rgba(6, 182, 212, 0.05)', padding: '12px', borderRadius: '8px', marginTop: '12px', marginBottom: '12px', borderLeft: '3px solid var(--teal)' }}>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '600' }}>💬 Comment:</div>
                                        <p className="review-comment">{review.comment}</p>
                                    </div>
                                )}
                                <div className="review-date">{formatDate(review.createdAt)}</div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            <Card>
                <div className="section-header">
                    <h3>Reviews I've Written</h3>
                    <span className="badge">{reviewsWritten?.length || 0}</span>
                </div>
                {loading ? <LoadingSpinner /> : !reviewsWritten || reviewsWritten.length === 0 ? (
                    <div className="empty-message"><p>You haven't written any reviews yet</p></div>
                ) : (
                    <div className="reviews-list">
                        {reviewsWritten.map((review, idx) => (
                            <div key={idx} className="review-item">
                                <div className="review-header">
                                    <div className="reviewer-info">
                                        <span>For Token #{review.targetTokenId}</span>
                                        {review.verified && <span className="verified-badge">✓ Verified</span>}
                                    </div>
                                    <div className="review-score">{review.score}/{MAX_SCORE}</div>
                                </div>
                                {review.comment && review.comment.trim() !== '' && (
                                    <div style={{ background: 'rgba(6, 182, 212, 0.05)', padding: '12px', borderRadius: '8px', marginTop: '12px', marginBottom: '12px', borderLeft: '3px solid var(--teal)' }}>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '600' }}>💬 Your Comment:</div>
                                        <p className="review-comment">{review.comment}</p>
                                    </div>
                                )}
                                <div className="review-date">{formatDate(review.createdAt)}</div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            <Modal isOpen={showReviewModal} onClose={() => setShowReviewModal(false)} title="Write Review">
                <div className="review-form">
                    {alreadyReviewed && reviewData.targetTokenId && reviewData.reviewerTokenId && (
                        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
                            <div style={{ color: 'var(--error)', fontWeight: '600', marginBottom: '4px' }}>❌ Already Reviewed</div>
                            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>You have already reviewed Token #{reviewData.targetTokenId}. The contract prevents duplicate reviews.</div>
                        </div>
                    )}
                    <Input label="Token ID to Review" value={reviewData.targetTokenId || ''} onChange={(val) => setReviewData({ ...reviewData, targetTokenId: val })} placeholder="Enter token ID you want to review" type="number" required />
                    <Select label="Your Token ID (Reviewer)" value={reviewData.reviewerTokenId} onChange={(val) => setReviewData({ ...reviewData, reviewerTokenId: val })} options={userTokens.map(t => ({ value: t.id.toString(), label: `Token #${t.id}` }))} required />
                    <div className="input-group">
                        <label className="input-label">Score (0-{MAX_SCORE}) * <span style={{ marginLeft: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Higher is better</span></label>
                        <input className="input-field" type="range" min="0" max={MAX_SCORE} value={reviewData.score} onChange={(e) => setReviewData({ ...reviewData, score: e.target.value })} />
                        <div style={{ textAlign: 'center', color: parseInt(reviewData.score) >= 70 ? 'var(--success)' : parseInt(reviewData.score) >= 40 ? 'var(--warning)' : 'var(--error)', fontSize: '32px', fontWeight: '700', marginTop: '8px' }}>
                            {reviewData.score} / {MAX_SCORE}
                        </div>
                    </div>
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <label className="input-label">Comment (Optional)</label>
                            <span style={{ fontSize: '0.8rem', color: commentLength > commentLimit ? 'var(--error)' : 'var(--text-muted)' }}>{commentLength}/{commentLimit}{commentLength > commentLimit && ' ⚠️'}</span>
                        </div>
                        <TextArea value={reviewData.comment} onChange={(val) => setReviewData({ ...reviewData, comment: val })} placeholder="Share your experience working with this person..." rows={4} />
                        {commentLength > commentLimit && <div style={{ fontSize: '0.8rem', color: 'var(--warning)', marginTop: '4px' }}>⚠️ Long comments cost more gas. Consider keeping it under {commentLimit} characters.</div>}
                    </div>
                    <div className="checkbox-group">
                        <label>
                            <input type="checkbox" checked={reviewData.verified} onChange={(e) => setReviewData({ ...reviewData, verified: e.target.checked })} />
                            <span>✓ We worked together (Verified)</span>
                        </label>
                    </div>
                    <div className="modal-actions">
                        <Button variant="secondary" onClick={() => setShowReviewModal(false)}>Cancel</Button>
                        <Button onClick={handleSubmitReview} disabled={!reviewData.reviewerTokenId || alreadyReviewed || checkingReviewed}>
                            {checkingReviewed ? 'Checking...' : alreadyReviewed ? 'Already Reviewed' : 'Submit Review'}
                        </Button>
                    </div>
                </div>
            </Modal>

            <ZKPSection contracts={contracts} selectedToken={selectedToken} showNotification={showNotification} />

            <style>{`
                .reputation-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
                .rep-card { text-align: center; }
                .rep-metric { padding: 20px; }
                .rep-value { font-size: 48px; font-weight: 700; color: var(--teal-light); margin-bottom: 8px; }
                .rep-label { font-size: 14px; color: var(--gray-light); text-transform: uppercase; letter-spacing: 1px; }
                .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
                .section-header h3 { font-size: 20px; color: var(--beige); }
                .badge { background: var(--teal); color: white; padding: 4px 12px; border-radius: 12px; font-size: 13px; font-weight: 600; }
                .empty-message { text-align: center; padding: 40px 20px; color: var(--gray-light); }
                .reviews-list { display: flex; flex-direction: column; gap: 16px; }
                .review-item { background: rgba(26, 35, 50, 0.5); border-radius: 8px; padding: 16px; border-left: 4px solid var(--teal); }
                .review-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
                .reviewer-info { display: flex; align-items: center; gap: 8px; color: var(--beige); font-size: 14px; font-weight: 500; }
                .verified-badge { background: var(--success); color: white; padding: 2px 8px; border-radius: 10px; font-size: 11px; }
                .review-score { font-size: 20px; font-weight: 700; color: var(--teal-light); }
                .review-comment { color: var(--text-primary); font-size: 0.95rem; line-height: 1.6; margin: 0; }
                .review-date { font-size: 12px; color: var(--gray); margin-top: 8px; }
                .review-form { display: flex; flex-direction: column; gap: 20px; }
                .checkbox-group { display: flex; flex-direction: column; gap: 12px; }
                .checkbox-group label { display: flex; align-items: center; gap: 8px; color: var(--beige); font-size: 14px; cursor: pointer; }
                .checkbox-group input[type="checkbox"] { width: 18px; height: 18px; cursor: pointer; }
                .modal-actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px; }
            `}</style>
        </div>
    );
}
