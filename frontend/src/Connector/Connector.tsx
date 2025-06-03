const ConnectorProps = {};

const Connector = (props: ConnectorProps) => {
  return (
    <svg width="190" height="160" xmlns="http://www.w3.org/2000/svg">
      <path d="M 10 10 C 20 50, 110 50, 120 10" stroke="black" fill="none" />
      <path d="M10 10 L20 50" stroke="gray" />
      <path d="M110 50 L120 10" stroke="gray" />
      <circle cx="10" cy="10" r="2" fill="red" />
      <circle cx="20" cy="50" r="2" fill="red" />
      <circle cx="110" cy="50" r="2" fill="green" />
      <circle cx="120" cy="10" r="2" fill="green" />
    </svg>
  );
};
