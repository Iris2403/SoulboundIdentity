# SoulBound Identity - Frontend Application

A decentralized professional identity platform built on blockchain technology. This frontend provides a complete interface for managing soulbound identity tokens, professional credentials, access control, and social features.

## 🎨 Design Features

- **Distinctive Aesthetic**: Navy, teal, sky blue, and beige color scheme with elegant Playfair Display and Work Sans typography
- **Smooth Animations**: Fade-ins, slide-ins, and hover effects throughout
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile
- **Modern UI**: Card-based layout with glassmorphism effects and floating background elements

## 🚀 Quick Start

### Prerequisites

- MetaMask browser extension installed
- Access to your Besu private network

### Installation

1. **Open the Application**
   - Simply open `index.html` in your web browser
   - Or use a local server (recommended):
     ```bash
     # Using Python
     python -m http.server 8000
     
     # Using Node.js http-server
     npx http-server
     ```

2. **Configure MetaMask**
   - Click "Connect Wallet"
   - MetaMask will prompt to add your custom network:
     - **Network Name**: QBFT_Besu_EduNet
     - **RPC URL**: https://rpc.dimikog.org/rpc/
     - **Chain ID**: 424242
     - **Currency Symbol**: ETH (or your custom symbol)

3. **Start Using**
   - Once connected, create your first identity token
   - Add credentials, manage access, and engage with social features

## 📋 Features

### 1. Identity Management 👤
- **Mint Soulbound Tokens**: Create non-transferable identity tokens
- **Metadata Storage**: Store identity information on IPFS
- **Multiple Tokens**: Manage multiple identity tokens per wallet
- **Burn Authorization**: Choose who can burn tokens (permanent, owner-only, issuer-only, or both)

### 2. Credentials Hub 📜
- **5 Credential Types**:
  - 🎓 Degrees
  - 📜 Certifications
  - 💼 Work Experience
  - 🆔 Identity Proofs
  - ⚡ Skills

- **Add Credentials**: Self-report or receive from authorized issuers
- **Verification Status**: Track which credentials are verified
- **Expiry Management**: Set and track expiration dates
- **Revocation**: Revoke credentials as needed

### 3. Access Control 🔐
- **Privacy First**: All data private by default
- **Request System**: Request access to view others' credentials
- **Approval Workflow**: Approve or deny access requests
- **Time-Limited Access**: Grant access for specific durations (default: 30 days)
- **Revocation**: Revoke access at any time

### 4. Social Hub 🤝
- **Reputation System**:
  - Receive and give reviews (0-100 score)
  - Track verified vs. unverified reviews
  - Anonymous reviews option
  - Average score calculation

- **Projects Portfolio**:
  - Showcase completed work
  - Add collaborators
  - Track project status
  - IPFS metadata storage

- **Skill Endorsements**:
  - Receive endorsements from peers
  - Track endorsement counts
  - Add comments to endorsements

## 🔧 Technical Details

### Contract Addresses

```javascript
SoulboundIdentity: 0xf1FB393025ef07673CcFBD5E83E07f6cF503F8ee
CredentialsHub:    0x25154346a75204f80108E73739f0A4AaD4754c8B
SocialHub:         0xbe78D2f3c24Abdd91AD8263D7cF10290F94045a7
```

### Network Configuration

```javascript
RPC_URL: https://rpc.dimikog.org/rpc/
CHAIN_ID: 424242
NETWORK_NAME: QBFT_Besu_EduNet
```

### Technology Stack

- **Frontend**: React 18 (CDN)
- **Web3**: ethers.js v5.7.2
- **Styling**: Custom CSS with CSS variables
- **Fonts**: Playfair Display & Work Sans (Google Fonts)

## 📱 User Guide

### Getting Started

1. **Connect Your Wallet**
   - Click "Connect Wallet" in the header
   - Approve MetaMask connection
   - Network will be auto-configured

2. **Create Identity Token**
   - Navigate to "Identity" tab
   - Click "Mint New Token"
   - Fill in your information:
     - Full Name
     - Bio
     - Profile Image URL (optional)
     - Burn Authorization level
   - Confirm transaction in MetaMask

3. **Add Credentials**
   - Navigate to "Credentials" tab
   - Click "Add Credential"
   - Select credential type
   - Fill in details
   - Confirm transaction

4. **Manage Access**
   - Navigate to "Access Control" tab
   - View pending access requests
   - Approve or deny requests
   - Request access to other tokens

5. **Build Reputation**
   - Navigate to "Social" tab
   - Submit reviews for others
   - Create projects
   - Endorse skills

## 🎯 Usage Tips

### For Identity Owners

- **Keep Metadata Accurate**: Your IPFS metadata is permanent
- **Review Access Requests**: Only approve trusted requesters
- **Monitor Credentials**: Regularly review and update credentials
- **Build Reputation**: Engage actively to build trust

### For Credential Issuers

- **Verify Before Issuing**: Only issue credentials you can verify
- **Set Expiry Dates**: Use expiry dates for time-sensitive credentials
- **Revoke When Needed**: Don't hesitate to revoke invalid credentials

### For Employers/Verifiers

- **Request Access First**: Always request formal access
- **Check Verification Status**: Prioritize verified credentials
- **Review Reputation**: Consider reputation scores and reviews
- **Check Project History**: Review completed projects

## 🔒 Security Best Practices

1. **Never Share Private Keys**: Keep your wallet seed phrase secure
2. **Verify Transactions**: Always check transaction details before confirming
3. **Use Hardware Wallets**: For production use, consider hardware wallets
4. **Regular Backups**: Backup your metadata and important data
5. **Monitor Activity**: Regularly check your identity tokens and access logs

## 🐛 Troubleshooting

### MetaMask Connection Issues
- Ensure MetaMask is installed and unlocked
- Check you're on the correct network
- Try refreshing the page

### Transaction Failures
- Ensure you have sufficient ETH for gas
- Check contract addresses are correct
- Verify you have proper permissions

### Loading Issues
- Clear browser cache
- Check browser console for errors
- Ensure network connectivity

### IPFS Issues
- In production, configure Pinata API credentials
- For demo purposes, mock CIDs are used
- Verify IPFS gateway accessibility

## 🔄 Future Enhancements

- [ ] Real IPFS integration with Pinata
- [ ] Image upload functionality
- [ ] Advanced search and filtering
- [ ] Notification system
- [ ] Export functionality (PDF reports)
- [ ] Analytics dashboard
- [ ] Multi-language support
- [ ] Dark/Light theme toggle

## 📊 Gas Optimization

The contracts are optimized for gas efficiency:
- Batch operations where possible
- Efficient storage patterns
- Minimal external calls
- Optimized loops with unchecked arithmetic

Typical gas costs:
- Mint Identity Token: ~200,000 gas
- Add Credential: ~150,000 gas
- Submit Review: ~120,000 gas
- Approve Access: ~80,000 gas

## 🤝 Contributing

This is a thesis project. For issues or suggestions:
1. Test thoroughly on the private network
2. Document any bugs with reproduction steps
3. Suggest improvements with clear use cases

## 📄 License

This is an academic thesis project. All rights reserved.

## 👥 Contact

For questions about this implementation, please contact the project maintainer.

---

**Built with ❤️ for decentralized identity**

Last Updated: January 2026
