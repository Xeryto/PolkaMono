import React from 'react';
import { SvgProps } from 'react-native-svg';
import OriginalSearchSvg from '../../assets/Search.svg';
import SearchDarkSvg from '../../assets/SearchDark.svg';
import { useTheme } from '../../lib/ThemeContext';

const Search: React.FC<SvgProps> = (props) => {
  const { colorScheme } = useTheme();
  return colorScheme === 'dark' ? <SearchDarkSvg {...props} /> : <OriginalSearchSvg {...props} />;
};

export default Search;
