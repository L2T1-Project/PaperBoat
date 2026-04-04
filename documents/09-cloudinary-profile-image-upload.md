# 09 Cloudinary Profile Image Upload

## What It Does
Lets user upload profile photo with backend validation and Cloudinary hosting, then saves secure URL in user profile.

## End-to-End Flow
1. User selects image on edit profile page.
2. Frontend sends multipart/form-data request.
3. Upload middleware validates file type and size.
4. Controller uploads buffer to Cloudinary.
5. Cloudinary returns secure URL.
6. User profile is updated with profile_pic_url.

## Main Files
Frontend:
- frontend/src/pages/EditProfilePage.jsx

Backend:
- backend/src/routes/userRoutes.js
  - POST /users/me/profile-photo
- backend/src/middlewares/uploadProfileImage.js
  - Multer memory storage, mime and size validation
- backend/src/controllers/userController.js
  - uploadMyProfilePhoto()
- backend/src/utils/cloudinary.js
  - uploadUserProfileImage()
- backend/src/models/userModel.js
  - profile update query

## Authorization
- Endpoint requires authenticated user token.
- User can update own profile image only.

## Main SQL Object
- user.profile_pic_url

## Why This Design
- Cloudinary stores optimized media externally.
- Backend validation blocks unsafe uploads.
- URL-only persistence keeps DB lightweight.

## Viva Questions
- Why memory storage before cloud upload?
- How do you ensure only image files are accepted?
- What happens when Cloudinary upload fails?

## Common Confusion
- Image binary is not stored in PostgreSQL.
- Controller should handle cloud failure and return proper error.

## Technical MCR Map
- R: POST /api/users/me/profile-photo
- C: userController.uploadMyProfilePhoto()
- M: userModel.updateMyProfile() (profile_pic_url update)
- Middleware: uploadProfileImage (Multer memoryStorage, size/type gate)
- Utility: cloudinary.uploadUserProfileImage()

## SQL Used
Profile URL persistence:
```sql
UPDATE "user"
SET profile_pic_url = $2,
    updated_at = NOW()
WHERE id = $1
RETURNING id, username, email, profile_pic_url;
```

## Cloudinary Call Characteristics
- folder: paperboat/profile_images
- public_id: user_<id>_<timestamp>
- transformation: quality auto, format auto, bounded sizing

Failure points to explain:
- invalid mime -> middleware rejection
- cloud upload failure -> controller error response
- DB update failure -> URL not persisted
