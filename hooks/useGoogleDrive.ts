import { useGoogleDriveContext } from '../contexts/GoogleDriveContext';

// We export the same interface to keep existing component logic working
export type { UnifiedStorage, DriveFile } from '../contexts/GoogleDriveContext';

export const useGoogleDrive = () => {
  return useGoogleDriveContext();
};