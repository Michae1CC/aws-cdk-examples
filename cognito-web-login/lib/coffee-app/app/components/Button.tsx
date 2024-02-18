interface FeaturedListProps {
  text: string;
  callback?: () => Promise<void>;
}

export default function FeaturedList(input: FeaturedListProps) {
  return (
    <button className="react-button" onClick={input.callback}>
      {input.text}
    </button>
  );
}
