import styled from "styled-components";

type Size = "sm" | "md" | "lg" | string | number;

interface AnimatedSwitchProps {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  size?: Size;
}

const AnimatedSwitch = ({
  id,
  checked,
  onCheckedChange,
  size = "md",
}: AnimatedSwitchProps) => {
  return (
    <StyledWrapper $size={size}>
      <div id={id}>
        <input
          id="check"
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheckedChange(e.target.checked)}
        />
        <label className="switch" htmlFor="check">
          <svg viewBox="0 0 212.4992 84.4688" overflow="visible">
            <path
              pathLength={360}
              fill="none"
              stroke="currentColor"
              d="M 42.2496 0 A 42.24 42.24 90 0 0 0 42.2496 A 42.24 42.24 90 0 0 42.2496 84.4688 A 42.24 42.24 90 0 0 84.4992 42.2496 A 42.24 42.24 90 0 0 42.2496 0 A 42.24 42.24 90 0 0 0 42.2496 A 42.24 42.24 90 0 0 42.2496 84.4688 L 170.2496 84.4688 A 42.24 42.24 90 0 0 212.4992 42.2496 A 42.24 42.24 90 0 0 170.2496 0 A 42.24 42.24 90 0 0 128 42.2496 A 42.24 42.24 90 0 0 170.2496 84.4688 A 42.24 42.24 90 0 0 212.4992 42.2496 A 42.24 42.24 90 0 0 170.2496 0 L 42.2496 0"
            />
          </svg>
        </label>
      </div>
    </StyledWrapper>
  );
};

const getSizeValue = (size: Size): string => {
  if (typeof size === "number") {
    return `${size}px`;
  }
  if (
    typeof size === "string" &&
    (size.includes("px") || size.includes("em") || size.includes("rem"))
  ) {
    return size;
  }
  switch (size) {
    case "sm":
      return "1.5em";
    case "md":
      return "2em";
    case "lg":
      return "2.5em";
    default:
      return "2em";
  }
};

const getShadowSize = (size: Size): string => {
  const sizeValue = getSizeValue(size);
  // For em/rem units, use calc, for px we can calculate directly
  if (sizeValue.includes("em") || sizeValue.includes("rem")) {
    const numericValue = parseFloat(sizeValue);
    const unit = sizeValue.replace(/[0-9.]/g, "");
    return `${numericValue * 0.33}${unit}`;
  }
  if (sizeValue.includes("px")) {
    const numericValue = parseFloat(sizeValue);
    return `${numericValue * 0.33}px`;
  }
  return "0.66em"; // fallback
};

const StyledWrapper = styled.div<{ $size: Size }>`
  /* The switch - the box around the slider */
  .switch {
    --a: 0.5s ease-out;
    cursor: pointer;
    position: relative;
    display: inline-flex;
    height: ${({ $size }) => getSizeValue($size)};
    border-radius: ${({ $size }) => getSizeValue($size)};
    box-shadow: 0 0 0 ${({ $size }) => getShadowSize($size)} var(--primary);
    aspect-ratio: 212.4992/84.4688;
    background-color: var(--primary);
  }

  /* Hide default HTML checkbox */
  #check {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .switch svg {
    height: 100%;
  }

  .switch svg path {
    color: #fff;
    stroke-width: 16;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-dasharray: 136 224;
    transition:
      all var(--a),
      0s transform;
    transform-origin: center;
  }

  #check:checked ~ .switch svg path {
    stroke-dashoffset: 180;
    transform: scaleY(-1);
  }
`;

export default AnimatedSwitch;
