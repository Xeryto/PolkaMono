import React from 'react';
import { SvgProps } from 'react-native-svg';
import OriginalScrollSvg from '../../assets/Scroll.svg';

const Scroll: React.FC<SvgProps> = (props) => {
  return <OriginalScrollSvg {...props} />;
};

export default Scroll;