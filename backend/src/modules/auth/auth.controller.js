import { sendSuccess } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { changeCurrentUserPassword, loginWithEmailPassword, registerUser, updateCurrentUserProfile, requestPasswordReset, resetPasswordWithToken } from './auth.service.js';

export const register = asyncHandler(async (req, res) => {
  const data = await registerUser(req.body);

  return sendSuccess(res, {
    message: 'Registered successfully.',
    data,
  });
});

export const login = asyncHandler(async (req, res) => {
  const data = await loginWithEmailPassword(req.body);

  return sendSuccess(res, {
    message: 'Login successfully.',
    data,
  });
});

export const me = asyncHandler(async (req, res) => {
  return sendSuccess(res, {
    message: 'Current user loaded.',
    data: {
      user: req.user,
    },
  });
});

export const updateMe = asyncHandler(async (req, res) => {
  const user = await updateCurrentUserProfile(req.user.id, req.body);

  return sendSuccess(res, {
    message: 'Profile updated successfully.',
    data: {
      user,
    },
  });
});

export const changePassword = asyncHandler(async (req, res) => {
  await changeCurrentUserPassword(req.user.id, req.body);

  return sendSuccess(res, {
    message: 'Password changed successfully.',
  });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const { email, username } = req.body;
  await requestPasswordReset({ email, username });

  return sendSuccess(res, {
    message: 'Verification code sent to your email.',
  });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { email, token, newPassword } = req.body;
  await resetPasswordWithToken({ email, token, newPassword });

  return sendSuccess(res, {
    message: 'Password reset successfully.',
  });
});
