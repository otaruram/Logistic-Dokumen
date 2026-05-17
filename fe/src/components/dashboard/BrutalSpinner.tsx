interface BrutalSpinnerProps {
  size?: "sm" | "md" | "lg";
}

const BrutalSpinner = ({ size = "md" }: BrutalSpinnerProps) => {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-12 h-12"
  };

  return (
    <div className={`${sizeClasses[size]} brutal-border-thin brutal-spinner bg-primary`} />
  );
};

export default BrutalSpinner;
