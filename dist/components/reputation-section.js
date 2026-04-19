ReputationSection = function ({
  reputation,
  reviews,
  reviewsWritten,
  loading,
  contracts,
  selectedToken,
  userTokens,
  showNotification,
  onReload,
  hasReviewedCache,
  setHasReviewedCache,
  MAX_SCORE
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
      setHasReviewedCache(prev => ({
        ...prev,
        [cacheKey]: hasReviewed
      }));
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
      if (targetId === reviewerId) {
        showNotification('You cannot review yourself!', 'error');
        return;
      }
      const cacheKey = `${reviewerId}-${targetId}`;
      if (hasReviewedCache[cacheKey]) {
        showNotification('You have already reviewed this token!', 'error');
        return;
      }
      try {
        await contracts.soulbound.ownerOf(targetId);
      } catch (err) {
        showNotification(`Token #${targetId} does not exist!`, 'error');
        return;
      }
      try {
        const owner = await contracts.soulbound.ownerOf(reviewerId);
        const myAddress = await contracts.soulbound.signer.getAddress();
        if (owner.toLowerCase() !== myAddress.toLowerCase()) {
          showNotification(`You don't own Token #${reviewerId}!`, 'error');
          return;
        }
      } catch (err) {
        showNotification(`Token #${reviewerId} does not exist!`, 'error');
        return;
      }
      const score = parseInt(reviewData.score);
      if (score < 0 || score > MAX_SCORE) {
        showNotification(`Score must be between 0 and ${MAX_SCORE}!`, 'error');
        return;
      }
      const tx = await contracts.social.submitReview(targetId, reviewerId, score, reviewData.verified, false,
      // isAnonymous always false
      reviewData.comment);
      showNotification('Submitting review...', 'info');
      await tx.wait();
      const storedReviews = JSON.parse(localStorage.getItem(`reviews_written_${reviewerId}`) || '[]');
      storedReviews.push({
        targetTokenId: targetId,
        timestamp: Date.now()
      });
      localStorage.setItem(`reviews_written_${reviewerId}`, JSON.stringify(storedReviews));
      setHasReviewedCache(prev => ({
        ...prev,
        [cacheKey]: true
      }));
      showNotification('Review submitted successfully!', 'success');
      setShowReviewModal(false);
      setReviewData({
        targetTokenId: '',
        reviewerTokenId: '',
        score: '75',
        verified: false,
        comment: ''
      });
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
  return /*#__PURE__*/React.createElement("div", {
    className: "reputation-section"
  }, reputation && /*#__PURE__*/React.createElement("div", {
    className: "reputation-summary"
  }, /*#__PURE__*/React.createElement(Card, {
    className: "rep-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rep-metric"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rep-value"
  }, reputation.averageScore), /*#__PURE__*/React.createElement("div", {
    className: "rep-label"
  }, "Average Score"))), /*#__PURE__*/React.createElement(Card, {
    className: "rep-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rep-metric"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rep-value"
  }, reputation.totalReviews), /*#__PURE__*/React.createElement("div", {
    className: "rep-label"
  }, "Total Reviews"))), /*#__PURE__*/React.createElement(Card, {
    className: "rep-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rep-metric"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rep-value"
  }, reputation.verifiedReviews), /*#__PURE__*/React.createElement("div", {
    className: "rep-label"
  }, "Verified Reviews")))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    className: "section-header"
  }, /*#__PURE__*/React.createElement("h3", null, "Reviews Received"), /*#__PURE__*/React.createElement(Button, {
    onClick: () => setShowReviewModal(true)
  }, "Write Review")), loading ? /*#__PURE__*/React.createElement(LoadingSpinner, null) : reviews.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "empty-message"
  }, /*#__PURE__*/React.createElement("p", null, "No reviews yet")) : /*#__PURE__*/React.createElement("div", {
    className: "reviews-list"
  }, reviews.map((review, idx) => /*#__PURE__*/React.createElement("div", {
    key: idx,
    className: "review-item"
  }, /*#__PURE__*/React.createElement("div", {
    className: "review-header"
  }, /*#__PURE__*/React.createElement("div", {
    className: "reviewer-info"
  }, /*#__PURE__*/React.createElement("span", null, "Token #", review.reviewerTokenId.toString()), review.verified && /*#__PURE__*/React.createElement("span", {
    className: "verified-badge"
  }, "\u2713 Verified")), /*#__PURE__*/React.createElement("div", {
    className: "review-score"
  }, review.score, "/", MAX_SCORE)), review.comment && review.comment.trim() !== '' && /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'rgba(6, 182, 212, 0.05)',
      padding: '12px',
      borderRadius: '8px',
      marginTop: '12px',
      marginBottom: '12px',
      borderLeft: '3px solid var(--teal)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.85rem',
      color: 'var(--text-muted)',
      marginBottom: '4px',
      fontWeight: '600'
    }
  }, "\uD83D\uDCAC Comment:"), /*#__PURE__*/React.createElement("p", {
    className: "review-comment"
  }, review.comment)), /*#__PURE__*/React.createElement("div", {
    className: "review-date"
  }, formatDate(review.createdAt)))))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    className: "section-header"
  }, /*#__PURE__*/React.createElement("h3", null, "Reviews I've Written"), /*#__PURE__*/React.createElement("span", {
    className: "badge"
  }, reviewsWritten?.length || 0)), loading ? /*#__PURE__*/React.createElement(LoadingSpinner, null) : !reviewsWritten || reviewsWritten.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "empty-message"
  }, /*#__PURE__*/React.createElement("p", null, "You haven't written any reviews yet")) : /*#__PURE__*/React.createElement("div", {
    className: "reviews-list"
  }, reviewsWritten.map((review, idx) => /*#__PURE__*/React.createElement("div", {
    key: idx,
    className: "review-item"
  }, /*#__PURE__*/React.createElement("div", {
    className: "review-header"
  }, /*#__PURE__*/React.createElement("div", {
    className: "reviewer-info"
  }, /*#__PURE__*/React.createElement("span", null, "For Token #", review.targetTokenId), review.verified && /*#__PURE__*/React.createElement("span", {
    className: "verified-badge"
  }, "\u2713 Verified")), /*#__PURE__*/React.createElement("div", {
    className: "review-score"
  }, review.score, "/", MAX_SCORE)), review.comment && review.comment.trim() !== '' && /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'rgba(6, 182, 212, 0.05)',
      padding: '12px',
      borderRadius: '8px',
      marginTop: '12px',
      marginBottom: '12px',
      borderLeft: '3px solid var(--teal)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.85rem',
      color: 'var(--text-muted)',
      marginBottom: '4px',
      fontWeight: '600'
    }
  }, "\uD83D\uDCAC Your Comment:"), /*#__PURE__*/React.createElement("p", {
    className: "review-comment"
  }, review.comment)), /*#__PURE__*/React.createElement("div", {
    className: "review-date"
  }, formatDate(review.createdAt)))))), /*#__PURE__*/React.createElement(Modal, {
    isOpen: showReviewModal,
    onClose: () => setShowReviewModal(false),
    title: "Write Review"
  }, /*#__PURE__*/React.createElement("div", {
    className: "review-form"
  }, alreadyReviewed && reviewData.targetTokenId && reviewData.reviewerTokenId && /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'rgba(239, 68, 68, 0.1)',
      border: '1px solid rgba(239, 68, 68, 0.3)',
      borderRadius: '8px',
      padding: '12px',
      marginBottom: '16px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--error)',
      fontWeight: '600',
      marginBottom: '4px'
    }
  }, "\u274C Already Reviewed"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.9rem',
      color: 'var(--text-secondary)'
    }
  }, "You have already reviewed Token #", reviewData.targetTokenId, ". The contract prevents duplicate reviews.")), /*#__PURE__*/React.createElement(Input, {
    label: "Token ID to Review",
    value: reviewData.targetTokenId || '',
    onChange: val => setReviewData({
      ...reviewData,
      targetTokenId: val
    }),
    placeholder: "Enter token ID you want to review",
    type: "number",
    required: true
  }), /*#__PURE__*/React.createElement(Select, {
    label: "Your Token ID (Reviewer)",
    value: reviewData.reviewerTokenId,
    onChange: val => setReviewData({
      ...reviewData,
      reviewerTokenId: val
    }),
    options: userTokens.map(t => ({
      value: t.id.toString(),
      label: `Token #${t.id}`
    })),
    required: true
  }), /*#__PURE__*/React.createElement("div", {
    className: "input-group"
  }, /*#__PURE__*/React.createElement("label", {
    className: "input-label"
  }, "Score (0-", MAX_SCORE, ") *", /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: '8px',
      fontSize: '0.85rem',
      color: 'var(--text-muted)'
    }
  }, "Higher is better")), /*#__PURE__*/React.createElement("input", {
    className: "input-field",
    type: "range",
    min: "0",
    max: MAX_SCORE,
    value: reviewData.score,
    onChange: e => setReviewData({
      ...reviewData,
      score: e.target.value
    })
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      color: parseInt(reviewData.score) >= 70 ? 'var(--success)' : parseInt(reviewData.score) >= 40 ? 'var(--warning)' : 'var(--error)',
      fontSize: '32px',
      fontWeight: '700',
      marginTop: '8px'
    }
  }, reviewData.score, " / ", MAX_SCORE)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: '8px'
    }
  }, /*#__PURE__*/React.createElement("label", {
    className: "input-label"
  }, "Comment (Optional)"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '0.8rem',
      color: commentLength > commentLimit ? 'var(--error)' : 'var(--text-muted)'
    }
  }, commentLength, "/", commentLimit, commentLength > commentLimit && ' ⚠️')), /*#__PURE__*/React.createElement(TextArea, {
    value: reviewData.comment,
    onChange: val => setReviewData({
      ...reviewData,
      comment: val
    }),
    placeholder: "Share your experience working with this person...",
    rows: 4
  }), commentLength > commentLimit && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.8rem',
      color: 'var(--warning)',
      marginTop: '4px'
    }
  }, "\u26A0\uFE0F Long comments cost more gas. Consider keeping it under ", commentLimit, " characters.")), /*#__PURE__*/React.createElement("div", {
    className: "checkbox-group"
  }, /*#__PURE__*/React.createElement("label", null, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: reviewData.verified,
    onChange: e => setReviewData({
      ...reviewData,
      verified: e.target.checked
    })
  }), /*#__PURE__*/React.createElement("span", null, "\u2713 We worked together (Verified)"))), /*#__PURE__*/React.createElement("div", {
    className: "modal-actions"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    onClick: () => setShowReviewModal(false)
  }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
    onClick: handleSubmitReview,
    disabled: !reviewData.reviewerTokenId || alreadyReviewed || checkingReviewed
  }, checkingReviewed ? 'Checking...' : alreadyReviewed ? 'Already Reviewed' : 'Submit Review')))), /*#__PURE__*/React.createElement(ZKPSection, {
    contracts: contracts,
    selectedToken: selectedToken,
    showNotification: showNotification
  }), /*#__PURE__*/React.createElement("style", null, `
                .reputation-summary {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 20px;
                    margin-bottom: 30px;
                }

                .rep-card {
                    text-align: center;
                }

                .rep-metric {
                    padding: 20px;
                }

                .rep-value {
                    font-size: 48px;
                    font-weight: 700;
                    color: var(--teal-light);
                    margin-bottom: 8px;
                }

                .rep-label {
                    font-size: 14px;
                    color: var(--gray-light);
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }

                .section-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 24px;
                }

                .section-header h3 {
                    font-size: 20px;
                    color: var(--beige);
                }

                .badge {
                    background: var(--teal);
                    color: white;
                    padding: 4px 12px;
                    borderRadius: 12px;
                    font-size: 13px;
                    font-weight: 600;
                }

                .empty-message {
                    text-align: center;
                    padding: 40px 20px;
                    color: var(--gray-light);
                }

                .reviews-list {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                .review-item {
                    background: rgba(26, 35, 50, 0.5);
                    border-radius: 8px;
                    padding: 16px;
                    border-left: 4px solid var(--teal);
                }

                .review-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 12px;
                }

                .reviewer-info {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    color: var(--beige);
                    font-size: 14px;
                    font-weight: 500;
                }

                .verified-badge {
                    background: var(--success);
                    color: white;
                    padding: 2px 8px;
                    border-radius: 10px;
                    font-size: 11px;
                }

                .review-score {
                    font-size: 20px;
                    font-weight: 700;
                    color: var(--teal-light);
                }

                .review-comment {
                    color: var(--text-primary);
                    font-size: 0.95rem;
                    line-height: 1.6;
                    margin: 0;
                }

                .review-date {
                    font-size: 12px;
                    color: var(--gray);
                    marginTop: 8px;
                }

                .review-form {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }

                .checkbox-group {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .checkbox-group label {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    color: var(--beige);
                    font-size: 14px;
                    cursor: pointer;
                }

                .checkbox-group input[type="checkbox"] {
                    width: 18px;
                    height: 18px;
                    cursor: pointer;
                }

                .modal-actions {
                    display: flex;
                    gap: 12px;
                    justify-content: flex-end;
                    margin-top: 24px;
                }
            `));
};