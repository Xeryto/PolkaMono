import React from 'react';
import { SvgProps } from 'react-native-svg';
import OriginalSettingsSvg from '../../assets/Settings.svg';

const Settings: React.FC<SvgProps> = (props) => {
  return <OriginalSettingsSvg {...props} />;
};

export default Settings;