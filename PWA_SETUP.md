# PWA Icons Setup

To complete your PWA setup for iPhone, you need to add these icon files to your `public` folder:

## Required Icons:

1. **favicon.ico** (16x16, 32x32, 48x48) - Browser favicon
2. **apple-touch-icon.png** (180x180) - iOS home screen icon
3. **pwa-192x192.png** (192x192) - Android/PWA icon
4. **pwa-512x512.png** (512x512) - Large PWA icon
5. **masked-icon.svg** - Safari pinned tab icon (monochrome SVG)

## Icon Guidelines for iPhone:

- **Apple Touch Icon (180x180)**: This is what users see when they add your app to their iPhone home screen
- **No transparency**: iOS will add rounded corners automatically
- **High contrast**: Make sure your icon looks good on both light and dark backgrounds
- **Simple design**: Icons should be recognizable at small sizes

## Quick Icon Generation Tools:

- **PWA Builder**: https://pwabuilder.com (generates all sizes)
- **Favicon Generator**: https://realfavicongenerator.net
- **App Icon Generator**: https://appicon.co

## Next Steps:

1. Create your icons and place them in the `public` folder
2. Test your PWA locally with `npm run dev`
3. Deploy to a HTTPS domain (required for PWAs)
4. Test "Add to Home Screen" on iPhone Safari

## Testing on iPhone:

1. Open Safari and navigate to your deployed PWA
2. Tap the Share button
3. Select "Add to Home Screen"
4. Your app should appear like a native app!

Note: PWAs only work in Safari on iOS, and require HTTPS in production.