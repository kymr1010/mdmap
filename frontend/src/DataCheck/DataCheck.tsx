import { onMount } from "solid-js";

export const DataCheck = (props: { data: any; index: string }) => {
  onMount(() => {
    console.log("DataCheck mounted with data:", props.data);
  });

  return (
    <div>
      <p>{props.index}</p>
    </div>
  );
};
