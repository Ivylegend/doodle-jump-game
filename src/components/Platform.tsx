
type PlatformProps = {
  x: number;
  y: number;
  broken?: boolean;
};

export default function Platform({ x, y, broken = false }: PlatformProps) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 60,
        height: 15,
        backgroundColor: broken ? "brown" : "green",
        border: "2px solid black",
      }}
    />
  );
}
