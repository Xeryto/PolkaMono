import React from 'react';
import { SvgProps } from 'react-native-svg';
import OriginalSeenSvg from '../../assets/Seen.svg';

const Seen: React.FC<SvgProps> = (props) => {
  return <OriginalSeenSvg {...props} />;
};

export default Seen;