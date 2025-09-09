import React from 'react';
import { SvgProps } from 'react-native-svg';
import OriginalSearchSvg from '../../assets/Search.svg';

const Search: React.FC<SvgProps> = (props) => {
  return <OriginalSearchSvg {...props} />;
};

export default Search;