interface Props {
  children: React.ReactNode;
}

export default function FormErrorLabel({ children }: Props) {
  return <p className="text-xs text-red-500">{children}</p>;
}
