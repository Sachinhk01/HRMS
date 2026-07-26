import { getMyProfile, updateMyProfile, uploadMyProfilePhoto } from './employeeService';
import api from './api';

export const hrmsService = {
  getProfile: () => getMyProfile(),
  saveProfile: (updates) => updateMyProfile(updates),
  uploadPhoto: (file) => uploadMyProfilePhoto(file),

  changePassword: async ({ oldPassword, newPassword, confirmPassword }) => {
    const { data } = await api.post('/auth/change-password', {
      oldPassword,
      newPassword,
      confirmPassword,
    });
    return data;
  },
};