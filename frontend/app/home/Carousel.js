import { useRef, memo } from "react";
import { StackedCarousel, ResponsiveContainer} from "react-stacked-center-carousel";

export const data = [
  { cover: "./map1.svg", num: 1 },
  { cover: "./map3.svg", num: 2 },
  { cover: "./map2.svg", num: 3 },
  { cover: "./map6.svg", num: 4 },
  { cover: "./map4.svg", num: 5 },
  { cover: "./map5.svg", num: 6 },
];

export function ResponsiveCarousel() {
  const ref = useRef({});

  return (
    <div style={{ width: "100%", position: "relative" }}>
      {/* ResponsiveContainer will have the same width as its parent element */}
      <ResponsiveContainer
        carouselRef={ref}
        render={(parentWidth, carouselRef) => {
          let currentVisibleSlide = 5;
          if (parentWidth <= 1440) currentVisibleSlide = 3;
          else if (parentWidth <= 1080) currentVisibleSlide = 1;

          return (
            <StackedCarousel
              ref={carouselRef}
              data={data}
              carouselWidth={parentWidth}
              slideWidth={500}
              slideComponent={Card}
              maxVisibleSlide={7}
              currentVisibleSlide={currentVisibleSlide}
              useGrabCursor={true}
            />
          );
        }}
      />
    </div>
  );
}

// Very important to memoize your component!!!
const Card = memo(
  function (props) {
    const { data, dataIndex } = props;
    const { cover } = data[dataIndex];
    // const { title } = data[title];

    return (
      <div style={{ width: "100%", height: 300 }}>
        <img
          style={{
            height: "100%",
            width: "100%",
            objectFit: "cover",
            borderRadius: 10,
          }}
          draggable={false}
          src={cover}
          // alt={title}
        />
      </div>
    );
  },
  function (prevProps, nextProps) {
    return prevProps.dataIndex === nextProps.dataIndex;
  }
);