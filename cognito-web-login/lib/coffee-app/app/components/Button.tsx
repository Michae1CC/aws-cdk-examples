interface FeaturedListProps {
  text: string;
}

export default function FeaturedList(input: FeaturedListProps) {
  return <button className="react-button">{input.text}</button>;
}
