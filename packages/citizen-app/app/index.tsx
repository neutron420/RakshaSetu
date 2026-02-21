import { Redirect, RelativePathString } from 'expo-router';

export default function Index() {
  return <Redirect href={"/splash" as RelativePathString} />;
}
