import coffeeImage1 from "~/img/coffee_image.png";
import coffeeImage2 from "~/img/coffee_image2.png";
import coffeeImage3 from "~/img/coffee_image3.png";

export default function FeaturedPicture() {
  const items: Array<{ title: string; description: string; image: string }> = [
    {
      title: "Pouring the Perfect Latte Art",
      description:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nam et" +
        "venenatis risus. Integer at ipsum vehicula, laoreet enim a, varius" +
        "purus. Cras at aliquam est, quis ultricies risus.",
      image: coffeeImage1,
    },
    {
      title: "Pouring the Perfect Latte Art",
      description:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nam et" +
        "venenatis risus. Integer at ipsum vehicula, laoreet enim a, varius" +
        "purus. Cras at aliquam est, quis ultricies risus.",
      image: coffeeImage2,
    },
    {
      title: "A Guide to Mochas",
      description:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nam et" +
        "venenatis risus. Integer at ipsum vehicula, laoreet enim a, varius" +
        "purus. Cras at aliquam est, quis ultricies risus.",
      image: coffeeImage3,
    },
  ];

  return (
    <div className="featured-picture-container">
      {items.map((item, index) => {
        return (
          <div className="featured-picture" key={`featured-key-${index}`}>
            <img src={item.image} alt={item.title}></img>
            <h2>{item.title}</h2>
            <p>{item.description}</p>
          </div>
        );
      })}
    </div>
  );
}
