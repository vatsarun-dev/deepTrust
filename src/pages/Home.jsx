import Hero from "../components/Hero.jsx";
import FakeNewsSection from "../components/FakeNewsSection.jsx";
import ControlSection from "../components/ControlSection.jsx";
import RealitySection from "../components/RealitySection.jsx";
import SolutionSection from "../components/SolutionSection.jsx";
import CheckSection from "../components/CheckSection.jsx";
import ComplaintSection from "../components/ComplaintSection.jsx";

function Home() {
  return (
    <main>
      <Hero />
      <FakeNewsSection />
      <ControlSection />
      <RealitySection />
      <SolutionSection />
      <CheckSection />
      <ComplaintSection />
    </main>
  );
}

export default Home;
