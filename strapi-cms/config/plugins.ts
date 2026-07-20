import type { Core } from '@strapi/strapi';

const allowedMediaTypes = [
  'image/*',
  'video/*',
  'audio/*',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.*',
  'text/plain',
  'text/csv',
];

const deniedExecutableTypes = [
  'application/vnd.microsoft.portable-executable',
  'application/x-msdownload',
  'application/x-msdos-program',
  'application/x-executable',
  'application/x-dosexec',
  'application/x-sh',
  'text/x-shellscript',
  'application/x-mach-binary',
];

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Plugin => ({
  'users-permissions': {
    config: {
      jwtManagement: 'refresh',
      sessions: {
        httpOnly: true,
      },
    },
  },

  // ── Cloudinary Upload Provider ──────────────────────────────────────────────
  // All media uploaded via the Strapi admin is stored directly in Cloudinary.
  // Strapi only retains the Cloudinary URL — no local disk storage used.
  // Requires: npm install @strapi/provider-upload-cloudinary
  // Credentials from .env: CLOUDINARY_NAME, CLOUDINARY_KEY, CLOUDINARY_SECRET
  upload: {
    config: {
      provider: 'cloudinary',
      providerOptions: {
        cloud_name: env('CLOUDINARY_NAME'),
        api_key:    env('CLOUDINARY_KEY'),
        api_secret: env('CLOUDINARY_SECRET'),
      },
      actionOptions: {
        upload:       {},
        uploadStream: {},
        delete:       {},
      },
      security: {
        allowedTypes:  allowedMediaTypes,
        deniedTypes:   deniedExecutableTypes,
      },
    },
  },
});

export default config;

