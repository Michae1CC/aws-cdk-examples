export default function FeaturedList() {
  const items: Array<{ title: string; description: string }> = [
    {
      title: "Cold Brews",
      description:
        "Lorem ipsum dolor sit amet, consectetur adipiscing edivt. Nam et",
    },
    {
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
              <p>{item.description}</p>
            </a>
          </div>
        );
      })}
    </div>
  );
}
