import { memo, useCallback, useMemo } from 'react';
import { User } from 'lucide-react';

export enum ProfileImageSize {
  DEFAULT = 'default',
  MEDIUM = 'medium',
  SEMIMEDIUM = 'semimedium',
  SMALL = 'small',
  TINY = 'tiny'
}

interface Props {
  uploadedImage?: File | null;
  imageUrl?: string;
  size?: ProfileImageSize;
  disabled?: boolean;
}

const profileImageSizeClasses = {
  [ProfileImageSize.DEFAULT]: 'w-52 h-52',
  [ProfileImageSize.MEDIUM]: 'w-24 h-24',
  [ProfileImageSize.SEMIMEDIUM]: 'w-16 h-16',
  [ProfileImageSize.SMALL]: 'w-14 h-14',
  [ProfileImageSize.TINY]: 'w-8 h-8'
};

const iconSize = {
  [ProfileImageSize.DEFAULT]: 90,
  [ProfileImageSize.MEDIUM]: 36,
  [ProfileImageSize.SEMIMEDIUM]: 32,
  [ProfileImageSize.SMALL]: 24,
  [ProfileImageSize.TINY]: 12
};

function ProfileImage({
  uploadedImage,
  imageUrl,
  size = ProfileImageSize.DEFAULT,
  disabled = false
}: Props) {
  const baseClasses =
    'flex justify-center items-center text-4xl font-bold rounded-full bg-primary/20 text-primary';
  const disabledClasses = 'bg-detail-gray/50 text-detail-gray/50 cursor-not-allowed';
  const sizeClasses = profileImageSizeClasses[size];
  const combinedClasses = `${baseClasses} ${sizeClasses} ${disabled ? disabledClasses : ''}`;

  const getImageUrl = useCallback(() => {
    if (uploadedImage) {
      return URL.createObjectURL(uploadedImage);
    }
  }, [uploadedImage]);

  const perfilImageContainer = useMemo(() => {
    return (
      <div className={`relative bg-green-500 ${sizeClasses}`}>
        <div className={`${combinedClasses}  absolute`}>
          {
            <User
              size={iconSize[size as ProfileImageSize] || iconSize[ProfileImageSize.DEFAULT]}
              className={disabled ? 'text-detail-gray' : 'text-primary'}
            />
          }
        </div>
        <div
          className={`${combinedClasses} absolute`}
          style={{
            backgroundImage: uploadedImage ? `url(${getImageUrl()})` : `url(${imageUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        />
      </div>
    );
  }, [uploadedImage, imageUrl, combinedClasses, disabled, getImageUrl, size, sizeClasses]);

  return perfilImageContainer;
}

export default memo(
  ProfileImage,
  (prevProps, nextProps) =>
    prevProps.imageUrl === nextProps.imageUrl && prevProps.uploadedImage === nextProps.uploadedImage
);
