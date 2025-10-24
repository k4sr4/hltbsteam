# Chrome Web Store Publishing Checklist

## Pre-Submission Checklist

### ☐ 1. Developer Account
- [ x] Created Chrome Web Store developer account
- [ x] Paid $5 registration fee
- [ x] Completed identity verification (may take 1-3 days)

### ☐ 2. Icons Created
- [ x] icon16.png (16x16)
- [ x] icon32.png (32x32)
- [ x] icon48.png (48x48)
- [ x] icon128.png (128x128)
- [ x] All icons placed in `icons/` folder
- [ x] Updated `manifest.json` to reference new icons

### ☐ 3. Screenshots Prepared
- [ x] Screenshot 1: Extension in action on Steam page (1280x800)
- [ ] Screenshot 2: Settings popup (1280x800)
- [ ] Screenshot 3: Another game example (1280x800)
- [ ] Screenshots saved in `screenshots/` folder

### ☐ 4. Promotional Images (Optional)
- [ ] Small promo tile (440x280) - Recommended
- [ ] Large promo tile (920x680) - Optional
- [ ] Marquee promo (1400x560) - Optional

### ☐ 5. Store Listing Content
- [ ] Extension name finalized: "HowLongToBeat for Steam"
- [ ] Short description written (< 132 characters)
- [ ] Detailed description written (see STORE_LISTING.md)
- [ ] Category selected: Shopping (or Productivity)

### ☐ 6. Legal Documents
- [ ] Privacy policy written (see PRIVACY_POLICY.md)
- [ ] Privacy policy hosted online (GitHub Pages or your website)
- [ ] Privacy policy URL ready for store listing

### ☐ 7. Contact Information
- [ ] Support email address ready
- [ ] GitHub repository URL (if open source)
- [ ] Website URL (optional)

### ☐ 8. Manifest.json Review
- [ ] Name matches store listing
- [ ] Description is clear and concise
- [ ] Version number set (1.0.0 for initial release)
- [ ] Homepage URL added (optional)
- [ ] All icons properly referenced

### ☐ 9. Code Quality
- [ ] Run production build: `npm run build`
- [ ] Test extension locally in Chrome
- [ ] Verify all features work on Steam pages
- [ ] Check console for errors
- [ ] Test on multiple games
- [ ] Test settings popup functionality

### ☐ 10. Package Preparation
- [ ] Build folder ready: `dist/`
- [ ] Create ZIP file: `hltb-steam-extension.zip`
- [ ] ZIP file < 100 MB (yours should be ~2-3 MB)
- [ ] Test ZIP by extracting and loading in Chrome

## Submission Steps

### ☐ 11. Upload Extension
1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Click "New Item"
3. Upload `hltb-steam-extension.zip`
4. Wait for upload to complete

### ☐ 12. Complete Store Listing
Fill in all required fields:
- [ ] Product icon (128x128)
- [ ] Category: Shopping (or Productivity)
- [ ] Language: English
- [ ] Short description
- [ ] Detailed description
- [ ] Screenshots (minimum 1, recommended 5)
- [ ] Promotional images (optional)

### ☐ 13. Privacy & Legal
- [ ] Privacy policy URL
- [ ] Justify permissions (explain each permission)
- [ ] Single purpose description
- [ ] Declare if uses remote code (No)
- [ ] Declare if collects user data (No)

### ☐ 14. Distribution
- [ ] Visibility: Public
- [ ] Pricing: Free
- [ ] Regions: All regions (or select specific)

### ☐ 15. Submit for Review
- [ ] Review all information
- [ ] Click "Submit for Review"
- [ ] Save submission ID

## Post-Submission

### ☐ 16. Review Process (1-3 days typically)
- [ ] Monitor email for review status
- [ ] Check dashboard for updates
- [ ] Respond to any reviewer questions promptly

### ☐ 17. If Approved
- [ ] Extension goes live automatically
- [ ] Test installation from Chrome Web Store
- [ ] Share store URL with users
- [ ] Announce on social media, Reddit, etc.

### ☐ 18. If Rejected
- [ ] Read rejection reason carefully
- [ ] Fix issues identified
- [ ] Resubmit with changes explained

## Post-Publication

### ☐ 19. Monitoring
- [ ] Monitor user reviews and ratings
- [ ] Respond to user feedback
- [ ] Track installation count
- [ ] Monitor for reported bugs

### ☐ 20. Future Updates
- [ ] Increment version number in manifest.json
- [ ] Document changes in changelog
- [ ] Upload new ZIP file to dashboard
- [ ] Submit for review again

## Common Rejection Reasons to Avoid

1. **Unclear Permissions**: Clearly explain why each permission is needed
2. **Missing Privacy Policy**: Must have privacy policy even if you don't collect data
3. **Misleading Functionality**: Description must match actual functionality
4. **Copyright Issues**: Don't use trademarked names without permission
5. **Low Quality Icons**: Icons must be clear and professional
6. **Missing Screenshots**: At least one screenshot required
7. **Single Purpose Violation**: Extension must have one clear purpose

## Tips for Fast Approval

✅ **Do**:
- Be transparent about what the extension does
- Clearly justify all permissions
- Provide detailed, accurate description
- Use professional icons and screenshots
- Host privacy policy on public URL
- Respond quickly to reviewer questions

❌ **Don't**:
- Request unnecessary permissions
- Use misleading marketing language
- Include trademarked terms in name without permission
- Rush the submission (double-check everything)
- Ignore reviewer feedback

## Timeline Estimate

- **Developer Account Setup**: 1-3 days (identity verification)
- **Asset Creation**: 2-4 hours (icons, screenshots, descriptions)
- **Initial Submission**: 15-30 minutes
- **Review Process**: 1-3 business days (sometimes faster)
- **Total Time to Live**: 2-7 days

Good luck with your publication! 🚀
