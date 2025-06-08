interface Props {
  children: React.ReactNode;
}

const CardContainer: React.FC<Props> = ({ children }) => {
  return (
    <div
      className="flex flex-col gap-4 rounded-lg
     bg-white p-5 2xl:p-10 border-detail-border
      border w-full h-max">
      {children}
    </div>
  );
};

export default CardContainer;
