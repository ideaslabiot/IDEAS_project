import React from 'react';
import Select from 'react-select';

const options = [
  { value: '1', label: 'TV / Screens' },
  { value: '2', label: 'Computers' },
  { value: '3', label: 'Lights' },
  { value: '4', label: 'Projectors' }
];

const customStyles = {
  control: (base) => ({
    ...base,
    width: '100%',
    padding: '0.8vw',
    fontSize: '1.8vw',
    backgroundColor: '#CACACA',
    border: 'none',
    borderRadius: '12px',
    marginBottom: '1.2vh',
  }),
  option: (base, state) => ({
    ...base,
    padding: '0.8vw',
    fontSize: '1.8vw',
    backgroundColor: state.isFocused ? '#e6f2ff' : 'white',
    color: state.isFocused ? 'black' : 'black',
  }),
  menu: (base) => ({
    ...base,
    backgroundColor: 'white',
    zIndex: 10,
  }),
  menuPortal: (base) => ({
    ...base,
    zIndex: 9999,
  }),
};

export default function CustomSelect({ value, onChange, name }) {
  const selectedOption = options.find(opt => opt.value === String(value)) || null;

  const handleChange = (option) => {
    onChange({
      target: {
        name: name,
        value: option ? option.value : '',
      },
    });
  };

  return (
    <Select
      options={options}
      styles={customStyles}
      value={selectedOption}
      onChange={handleChange}
      menuPortalTarget={document.body}
      menuPosition="fixed"
      isClearable={false}
      isSearchable={false}
    />
  );
}