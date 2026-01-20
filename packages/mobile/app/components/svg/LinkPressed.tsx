import React from 'react';
import { SvgProps } from 'react-native-svg';
import OriginalLinkPressedSvg from '../../assets/LinkPressed.svg';

const LinkPressed: React.FC<SvgProps> = (props) => {
  return <OriginalLinkPressedSvg {...props} />;
};

export default LinkPressed;
