# builtday

> Document your project journey, day by day. Progress is the content.

## Stack
- **Auth**: Firebase Auth (Google + email)
- **Database**: Firestore
- **Media storage**: Backblaze B2
- **Frontend**: React
- **Hosting**: Cloudflare Pages

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Firebase setup
- Project: `test-run-builtday`
- Deploy Firestore rules: `firebase deploy --only firestore`
- Deploy indexes: `firebase deploy --only firestore:indexes`

### 3. Set admin role
Use Firebase Admin SDK or Firebase Console to set a custom claim on your user:
```js
admin.auth().setCustomUserClaims(uid, { isAdmin: true })
```

### 4. Backblaze B2
Bucket is configured as **public** so media URLs are directly accessible.  
CORS must be enabled on the bucket for browser uploads.

B2 CORS config (set via b2 CLI):
```json
[{
  "corsRuleName": "allowUploads",
  "allowedOrigins": ["*"],
  "allowedHeaders": ["*"],
  "allowedOperations": ["b2_upload_file", "b2_download_file_by_name"],
  "maxAgeSeconds": 3600
}]
```

Set CORS:
```bash
b2 update-bucket --corsRules '[{"corsRuleName":"allowUploads","allowedOrigins":["*"],"allowedHeaders":["*"],"allowedOperations":["b2_upload_file","b2_download_file_by_name"],"maxAgeSeconds":3600}]' builtday-media allPublic
```

### 5. Run locally
```bash
npm start
```

### 6. Deploy to Cloudflare Pages
```bash
npm run build
# Deploy the /build folder to Cloudflare Pages
# Set build command: npm run build
# Set output directory: build
```

## Firestore data model

```
users/{uid}
  displayName, email, bio, projectType, photoURL
  followersCount, followingCount, projectCount
  /follows/{projectId}          ← projects this user follows
  /userFollows/{targetUserId}   ← users this user follows
  /uploadLimits/{projectId}     ← { date, count } for 2/day enforcement

projects/{projectId}
  name, description, type, isPublic
  ownerId, ownerName, ownerPhoto
  currentStreak, longestStreak, lastLogDate
  dayCount, followersCount, viewCount, trendingScore
  bannedUsers[], milestones[], adminStatus
  /logs/{logId}
    title, text, images[], milestone
    dayNumber, authorId, authorName
    reactions: { inspired, relatable, helpful }
    trendingScore
    /reactions/{userId}   ← per-user reaction state
    /comments/{commentId} ← text, authorId, authorName, createdAt

feedIndex/{logId}         ← denormalized public log for feed queries

reports/{reportId}
  type, projectId, logId, reportedBy
  status: pending|warned|removed|dismissed
  reviewedBy, reviewedAt
```

## Trending score
Update `trendingScore` on each reaction write:
```
score = (inspired + relatable + helpful) * recencyFactor
recencyFactor = 1 / (hoursSincePost + 2)^1.5
```
Run this in a Cloud Function triggered on `feedIndex/{logId}` writes.
