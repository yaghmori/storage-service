import {
  FaLinkedin,
  FaTwitter,
  FaGithub,
  FaFacebook,
  FaInstagram,
  FaYoutube
} from 'react-icons/fa';

const socialMediaStyles = {
  linkedin:
    'text-[#0077B5] hover:text-[#005582] dark:text-[#00A0DC] dark:hover:text-[#0077B5]', // LinkedIn Blue
  twitter:
    'text-[#1DA1F2] hover:text-[#0d95e8] dark:text-[#1A91DA] dark:hover:text-[#0d81d3]', // Twitter Blue
  github:
    'text-[#171515] hover:text-[#333] dark:text-[#EDEDED] dark:hover:text-[#CFCFCF]', // GitHub Black
  facebook:
    'text-[#1877F2] hover:text-[#0e5a94] dark:text-[#3b5998] dark:hover:text-[#2d4373]', // Facebook Blue
  instagram:
    'text-[#E4405F] hover:text-[#d81a50] dark:text-[#F56040] dark:hover:text-[#E1306C]' // Instagram Pink
};

export const getSocialIcon = (url: string) => {
  if (url.includes('linkedin.com'))
    return {
      icon: <FaLinkedin size={18} />,
      className: socialMediaStyles.linkedin
    };
  if (url.includes('twitter.com'))
    return {
      icon: <FaTwitter size={18} />,
      className: socialMediaStyles.twitter
    };
  if (url.includes('github.com'))
    return {
      icon: <FaGithub size={18} />,
      className: socialMediaStyles.github
    };
  if (url.includes('facebook.com'))
    return {
      icon: <FaFacebook size={18} />,
      className: socialMediaStyles.facebook
    };
  if (url.includes('instagram.com'))
    return {
      icon: <FaInstagram size={18} />,
      className: socialMediaStyles.instagram
    };
    if (url.includes('youtube.com'))
      return {
        icon: <FaYoutube size={18} />,
        className: socialMediaStyles.instagram
      };
  return null;
};
