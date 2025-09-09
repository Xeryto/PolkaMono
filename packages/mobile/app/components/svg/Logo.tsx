import React from 'react';
import { SvgProps } from 'react-native-svg';
import OriginalLogoSvg from '../../assets/Logo.svg';

const Logo: React.FC<SvgProps> = (props) => {
  return <OriginalLogoSvg {...props} />;
};

export default Logo;