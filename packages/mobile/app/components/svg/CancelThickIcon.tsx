import React from 'react';
import { SvgProps } from 'react-native-svg';
import OriginalCancelThickIcon from '../../assets/Cancel.svg';

const CancelThickIcon: React.FC<SvgProps> = (props) => {
  return <OriginalCancelThickIcon {...props} />;
};

export default CancelThickIcon;