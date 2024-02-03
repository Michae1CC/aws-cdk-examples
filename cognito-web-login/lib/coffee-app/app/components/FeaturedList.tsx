export default function FeaturedList() {
  const items: Array<{ id: string; title: string; description: string }> = [
    {
      id: "1",
      title: "Cold Brews",
      description:
        "Lorem ipsum dolor sit amet, consectetur adipiscing edivt. Nam et",
    },
    {
      id: "2",
      title: "Arabica vs Robusta: The Differences",
      description:
        "Lorem ipsum dolor sit amet, consectetur adipiscing edivt. Nam et",
    },
  ];

  return (
    <div className="featured-list">
      <h3>Featured</h3>
      <hr />
      {items.map((item, index) => {
        return (
          <div className="featured-list-item" key={`featured-list-${index}`}>
            <a href="/">
              <h4>{item.title}</h4>
              <div>{item.description}</div>
            </a>
          </div>
        );
      })}
    </div>
  );
}
