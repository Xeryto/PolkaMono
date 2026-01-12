import React from 'react';
import { SvgProps } from 'react-native-svg';
import OriginalPenSvg from '../../assets/pen.svg';

const PenIcon: React.FC<SvgProps> = (props) => {
  return <OriginalPenSvg {...props} />;
};

export default PenIcon;