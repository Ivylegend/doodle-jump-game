type CowProps = {
  x: number;
  y: number;
};

export default function Cow({ x, y }: CowProps) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 40,
        height: 40,
        backgroundImage: "url('/cow.png')", // Add your cow image in /public
        backgroundSize: "cover",
      }}
    />
  );
}
