# Deployment & Testing Guide

## 🎯 Quick Testing Checklist

Use this checklist to verify all features work correctly on your Besu network.

### ✅ Phase 1: Wallet Connection
- [ ] Open index.html in browser
- [ ] Click "Connect Wallet"
- [ ] Approve MetaMask connection
- [ ] Verify network switches to QBFT_Besu_EduNet (Chain ID: 424242)
- [ ] Confirm wallet address displays in header

### ✅ Phase 2: Identity Management
- [ ] Navigate to "Identity" tab
- [ ] Click "Mint New Token"
- [ ] Fill in form:
  - [ ] Name: Test User
  - [ ] Bio: Sample bio text
  - [ ] Profile Image: (optional)
  - [ ] Burn Auth: Select option
- [ ] Click "Mint Token"
- [ ] Approve MetaMask transaction
- [ ] Wait for confirmation
- [ ] Verify token appears in grid
- [ ] Verify token is auto-selected
- [ ] Check token card shows correct info

### ✅ Phase 3: Credentials Management
- [ ] Navigate to "Credentials" tab
- [ ] Verify summary cards show 0 counts
- [ ] Click "Add Credential"
- [ ] Test adding Degree:
  - [ ] Type: Degree
  - [ ] Institution: MIT
  - [ ] Title: Bachelor of Science
  - [ ] Description: Computer Science
  - [ ] Issue Date: Select date
  - [ ] Confirm transaction
- [ ] Test adding Certification:
  - [ ] Type: Certification
  - [ ] Institution: AWS
  - [ ] Title: Solutions Architect
  - [ ] Confirm transaction
- [ ] Test adding Work Experience:
  - [ ] Type: Work Experience
  - [ ] Institution: Google
  - [ ] Title: Software Engineer
  - [ ] Confirm transaction
- [ ] Test adding Skill:
  - [ ] Type: Skill
  - [ ] Institution: Self
  - [ ] Title: Solidity Programming
  - [ ] Category: Technical
  - [ ] Confirm transaction
- [ ] Verify summary cards update
- [ ] Test credential filters
- [ ] Test revoking a credential
- [ ] Verify credential status changes

### ✅ Phase 4: Access Control
- [ ] Navigate to "Access Control" tab
- [ ] Create second wallet/account in MetaMask
- [ ] From second account:
  - [ ] Click "Request Access to Token"
  - [ ] Enter your token ID (from first account)
  - [ ] Submit request
  - [ ] Approve transaction
- [ ] Switch back to first account
- [ ] Verify request appears in pending list
- [ ] Test approving request:
  - [ ] Click "Approve"
  - [ ] Confirm transaction
  - [ ] Verify request disappears
- [ ] Test denying request:
  - [ ] Create another request from second account
  - [ ] Click "Deny"
  - [ ] Confirm transaction
  - [ ] Verify request disappears

### ✅ Phase 5: Social Features

#### Reputation Testing
- [ ] Navigate to "Social" tab → "Reputation"
- [ ] Verify reputation summary shows 0 reviews
- [ ] From second account:
  - [ ] Click "Write Review"
  - [ ] Select reviewer token ID
  - [ ] Set score (0-100)
  - [ ] Add comment
  - [ ] Check "We worked together"
  - [ ] Submit review
  - [ ] Confirm transaction
- [ ] Switch to first account
- [ ] Verify review appears
- [ ] Verify reputation summary updates
- [ ] Check average score calculation

#### Projects Testing
- [ ] Navigate to "Social" tab → "Projects"
- [ ] Verify shows 0 projects
- [ ] Note: Project creation can be tested if needed
  - Would require adding UI for project creation

#### Endorsements Testing
- [ ] Navigate to "Social" tab → "Endorsements"
- [ ] Verify shows 0 endorsements
- [ ] Note: Endorsement feature can be tested if needed
  - Would require adding UI for endorsement submission

## 🔍 Debug Checklist

If something doesn't work, check:

### Browser Console
```javascript
// Open browser DevTools (F12)
// Check for errors in Console tab
// Look for:
- Red error messages
- Failed transactions
- Network errors
- Contract call failures
```

### MetaMask
- [ ] Correct network selected (Chain ID 424242)
- [ ] Sufficient ETH for gas
- [ ] No pending transactions stuck
- [ ] Account has access to contracts

### Network Connectivity
```bash
# Test RPC endpoint
curl https://rpc.dimikog.org/rpc/ \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# Should return current block number
```

### Contract Verification
```javascript
// In browser console:
// Check if contracts are deployed
console.log('SoulboundIdentity:', '0xf1FB393025ef07673CcFBD5E83E07f6cF503F8ee');
console.log('CredentialsHub:', '0x25154346a75204f80108E73739f0A4AaD4754c8B');
console.log('SocialHub:', '0xbe78D2f3c24Abdd91AD8263D7cF10290F94045a7');
```

## 🐛 Common Issues & Solutions

### Issue: "Failed to connect wallet"
**Solutions:**
1. Install/update MetaMask
2. Unlock MetaMask
3. Refresh page
4. Clear browser cache

### Issue: "Transaction failed"
**Solutions:**
1. Check gas balance
2. Increase gas limit
3. Verify contract address
4. Check function parameters

### Issue: "Cannot read property of undefined"
**Solutions:**
1. Ensure token is selected
2. Refresh data
3. Check contract connection
4. Verify token exists

### Issue: "Network request failed"
**Solutions:**
1. Check internet connection
2. Verify RPC URL accessible
3. Test with curl command
4. Check firewall settings

### Issue: "Pending requests not showing"
**Solutions:**
1. Refresh page
2. Switch tokens and back
3. Check from requester's perspective
4. Verify transaction confirmed

## 📊 Expected Gas Costs

Based on your contract implementation:

| Operation | Estimated Gas | ETH (at 20 Gwei) |
|-----------|---------------|------------------|
| Mint Identity Token | ~200,000 | 0.004 ETH |
| Add Credential | ~150,000 | 0.003 ETH |
| Issue Credential (Authorized) | ~160,000 | 0.0032 ETH |
| Request Access | ~80,000 | 0.0016 ETH |
| Approve Access | ~90,000 | 0.0018 ETH |
| Deny Access | ~70,000 | 0.0014 ETH |
| Submit Review | ~120,000 | 0.0024 ETH |
| Create Project | ~130,000 | 0.0026 ETH |
| Endorse Skill | ~100,000 | 0.002 ETH |
| Revoke Credential | ~60,000 | 0.0012 ETH |

*Note: Actual gas costs may vary based on network conditions*

## 🎬 Demo Scenario

### Complete User Journey (15 minutes)

**Setup (2 min)**
1. Open application
2. Connect wallet
3. Mint identity token

**Build Profile (5 min)**
1. Add degree credential
2. Add 2 certifications
3. Add 2 work experiences
4. Add 3-5 skills

**Access Control (3 min)**
1. Switch to second account
2. Request access to first account's token
3. Switch back
4. Approve request

**Social Engagement (5 min)**
1. Second account writes review
2. First account reads review
3. Check reputation score
4. Test anonymous review

**Verification**
- All credentials visible
- Access properly managed
- Reputation calculated
- UI responsive and smooth

## 📸 Screenshots to Capture

For your thesis documentation:

1. **Welcome Screen** - Initial landing page
2. **Wallet Connection** - MetaMask popup
3. **Identity Creation** - Mint modal
4. **Token Display** - Token cards grid
5. **Credentials Summary** - Summary cards with counts
6. **Credentials List** - Different credential types
7. **Add Credential Modal** - Form interface
8. **Access Requests** - Pending requests list
9. **Access Approval** - Approve/Deny buttons
10. **Reputation Summary** - Score metrics
11. **Review Card** - Individual review display
12. **Project Portfolio** - Projects grid
13. **Mobile View** - Responsive design
14. **Transaction Confirmation** - MetaMask tx

## 🎓 Thesis Evaluation Points

Demonstrate these capabilities:

### Technical Implementation
- ✅ Web3 integration (ethers.js)
- ✅ Smart contract interaction
- ✅ Event handling
- ✅ State management
- ✅ Error handling
- ✅ Responsive design

### Blockchain Features
- ✅ Soulbound tokens (ERC-5484)
- ✅ Access control mechanisms
- ✅ Metadata storage (IPFS ready)
- ✅ Multi-contract architecture
- ✅ Gas optimization

### User Experience
- ✅ Intuitive interface
- ✅ Clear navigation
- ✅ Loading states
- ✅ Error messages
- ✅ Confirmation flows
- ✅ Responsive feedback

### Security
- ✅ Wallet-based authentication
- ✅ Transaction signing
- ✅ Access permissions
- ✅ Data privacy
- ✅ Input validation

## 📝 Testing Notes Template

Use this to document your testing:

```
Testing Session: [Date/Time]
Tester: [Name]
Network: QBFT_Besu_EduNet
Browser: [Chrome/Firefox/etc.]

=== IDENTITY ===
[ ] Token Minting: [Pass/Fail] - Notes:
[ ] Multiple Tokens: [Pass/Fail] - Notes:
[ ] Token Selection: [Pass/Fail] - Notes:

=== CREDENTIALS ===
[ ] Add Degree: [Pass/Fail] - Notes:
[ ] Add Certification: [Pass/Fail] - Notes:
[ ] Add Work Experience: [Pass/Fail] - Notes:
[ ] Add Skill: [Pass/Fail] - Notes:
[ ] Revoke Credential: [Pass/Fail] - Notes:
[ ] Summary Updates: [Pass/Fail] - Notes:

=== ACCESS CONTROL ===
[ ] Request Access: [Pass/Fail] - Notes:
[ ] Approve Access: [Pass/Fail] - Notes:
[ ] Deny Access: [Pass/Fail] - Notes:
[ ] Privacy Settings: [Pass/Fail] - Notes:

=== SOCIAL ===
[ ] Submit Review: [Pass/Fail] - Notes:
[ ] View Reviews: [Pass/Fail] - Notes:
[ ] Reputation Score: [Pass/Fail] - Notes:

=== PERFORMANCE ===
Transaction Times:
- Mint Token: [seconds]
- Add Credential: [seconds]
- Approve Access: [seconds]
- Submit Review: [seconds]

UI Responsiveness:
- Page Load: [seconds]
- Tab Switch: [smooth/laggy]
- Modal Open/Close: [smooth/laggy]

=== ISSUES FOUND ===
1. [Issue description]
2. [Issue description]

=== OVERALL ASSESSMENT ===
Rating: [1-10]
Comments:
```

## 🚀 Production Deployment Considerations

When moving beyond testing:

1. **IPFS Integration**
   - Set up Pinata account
   - Add API keys to frontend
   - Implement file upload
   - Test metadata retrieval

2. **Enhanced Security**
   - Add input sanitization
   - Implement rate limiting
   - Add CAPTCHA for public operations
   - Enhanced error messages

3. **Performance**
   - Implement caching
   - Lazy load components
   - Optimize images
   - Minimize bundle size

4. **Monitoring**
   - Add analytics
   - Error tracking
   - Transaction monitoring
   - User behavior tracking

---

Good luck with your thesis testing! 🎓
