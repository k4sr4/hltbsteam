# Quick Start: Publishing Your Extension

This is a simplified, action-focused guide to get your extension published quickly.

## Phase 1: Setup (15 minutes)

### Step 1: Create Developer Account
1. Go to https://chrome.google.com/webstore/devconsole
2. Sign in with Google account
3. Pay $5 registration fee
4. Wait for identity verification (1-3 days)

### Step 2: Create Icons (CRITICAL - Currently Missing)
You **MUST** create icons before publishing. Quick options:

**Option A: Use a Free Tool (Fastest)**
1. Go to https://www.canva.com
2. Create 128x128 design with:
   - Hourglass or clock icon (represents "time to beat")
   - Dark background (matches Steam)
   - Simple, recognizable design
3. Download as PNG
4. Resize to other sizes: https://www.iloveimg.com/resize-image
   - Create 16x16, 32x32, 48x48, 128x128
5. Save all in `dist/icons/` folder

**Option B: Hire on Fiverr ($5-20, 24 hours)**
1. Go to https://www.fiverr.com
2. Search "chrome extension icon"
3. Provide brief: "Hourglass/clock icon for gaming extension, 4 sizes needed"

**Option C: Use Placeholder (NOT RECOMMENDED)**
- Creates generic colored squares as placeholders
- Professional icons MUCH better for user trust

### Step 3: Take Screenshots
1. Build and load your extension: `npm run build`
2. Visit https://store.steampowered.com/app/220/HalfLife_2/
3. Take screenshot showing HLTB data on page (1280x800)
4. Click extension icon, take screenshot of popup (1280x800)
5. Save in `screenshots/` folder

## Phase 2: Prepare Files (10 minutes)

### Step 4: Update Manifest
Open `manifest.json` and update:
```json
"author": "Your Name",  // Line 57
"homepage_url": "https://github.com/yourusername/hltb-steam"  // Line 58 (or remove)
```

Copy updated manifest to dist:
```bash
copy manifest.json dist\manifest.json
```

### Step 5: Host Privacy Policy
**Quick option - Use GitHub Pages:**
1. Create repository on GitHub
2. Push your code (or just PRIVACY_POLICY.md)
3. Enable GitHub Pages in Settings
4. Your privacy policy URL will be: `https://yourusername.github.io/repo-name/PRIVACY_POLICY.html`

**Alternative - Copy/paste to any website you own**

### Step 6: Create Package
Run the packaging script:
```bash
package-extension.bat
```

This creates `release/hltb-steam-extension-v1.0.0.zip`

## Phase 3: Submit (20 minutes)

### Step 7: Upload to Chrome Web Store
1. Go to https://chrome.google.com/webstore/devconsole
2. Click "New Item"
3. Upload `release/hltb-steam-extension-v1.0.0.zip`
4. Wait for upload to complete

### Step 8: Fill Store Listing
Copy content from `STORE_LISTING.md`:

**Product Details:**
- Category: Shopping
- Language: English

**Store Listing:**
- Copy "Short Description" (132 char limit)
- Copy "Detailed Description"
- Upload screenshots (minimum 1)
- Upload icon (128x128)

### Step 9: Privacy & Permissions
**Privacy Policy URL:**
- Paste your hosted privacy policy URL

**Permission Justifications** (copy these exactly):

**storage**: "Required to cache game completion time data locally for faster loading and offline access. Also stores user settings like cache duration preferences."

**alarms**: "Required to schedule automatic cache cleanup every 24 hours to maintain optimal performance and storage usage."

**store.steampowered.com**: "Required to detect Steam game pages and inject completion time data. Read-only access to extract game title from the page."

**steamcommunity.com**: "Required to support Steam Community game pages. Read-only access to extract game title from the page."

**howlongtobeat.com**: "Required as fallback data source for games not in local database."

**Single Purpose**: "This extension displays game completion time data from HowLongToBeat.com on Steam store pages to help users make informed purchasing decisions."

### Step 10: Distribution Settings
- Visibility: Public
- Pricing: Free
- Countries: All countries

### Step 11: Submit for Review
1. Review all information carefully
2. Click "Submit for Review"
3. You'll receive confirmation email

## Phase 4: Wait for Approval (1-3 days)

### What Happens Next:
1. **Automated Check** (minutes): Scans for malware and policy violations
2. **Manual Review** (1-3 days): Human reviewer tests your extension
3. **Approval/Rejection** email sent

### If Approved: 🎉
- Extension goes live automatically
- You'll receive "Published" email
- Share your store URL!

### If Rejected:
- Read rejection reason carefully
- Fix the issue (usually permissions or description)
- Resubmit (usually approved within 24 hours)

## Common Issues & Solutions

### Issue 1: "Icons not found"
**Solution**: Create icons (see Step 2), place in `dist/icons/`, rebuild package

### Issue 2: "Permissions not justified"
**Solution**: Use the exact justifications in Step 9

### Issue 3: "Privacy policy required"
**Solution**: Host PRIVACY_POLICY.md online, add URL in submission

### Issue 4: "Misleading functionality"
**Solution**: Ensure description accurately describes what extension does

### Issue 5: "Screenshots required"
**Solution**: Add at least 1 screenshot (1280x800) showing extension in action

## Time Estimate

| Task | Time |
|------|------|
| Developer account setup | 5 min + 1-3 days wait |
| Create icons | 10 min - 24 hours |
| Take screenshots | 5 min |
| Update files | 5 min |
| Host privacy policy | 5 min |
| Package extension | 2 min |
| Fill store listing | 15 min |
| Review & submit | 5 min |
| **Total active time** | **~1 hour** |
| **Total wait time** | **2-7 days** |

## Your Next Action

**RIGHT NOW:**
1. Create Chrome Web Store developer account
2. While waiting for verification, create your icons
3. Follow this guide step-by-step

## Resources

- **Developer Dashboard**: https://chrome.google.com/webstore/devconsole
- **Developer Policies**: https://developer.chrome.com/docs/webstore/program-policies/
- **Publishing Guide**: https://developer.chrome.com/docs/webstore/publish/

## Need Help?

If you get stuck:
1. Check `PUBLISHING_CHECKLIST.md` for detailed steps
2. Review `MANIFEST_UPDATES.md` for manifest requirements
3. Read rejection email carefully if rejected
4. Google the specific error message

## Post-Publication

Once published:
1. Test installation from Chrome Web Store
2. Monitor reviews and respond to users
3. Share on Reddit: r/Steam, r/chrome_extensions
4. Monitor for bugs via GitHub Issues

Good luck! 🚀
