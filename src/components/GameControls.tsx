
type ControllerProps = {
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
};

export default function Controllers({
  onStart,
  onPause,
  onResume,
  onStop,
}: ControllerProps) {
  return (
    <div className="controllers">
      <button onClick={onStart}>Start</button>
      <button onClick={onPause}>Pause</button>
      <button onClick={onResume}>Resume</button>
      <button onClick={onStop}>Stop</button>
    </div>
  );
}
