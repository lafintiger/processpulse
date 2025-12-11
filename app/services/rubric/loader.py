"""
Rubric Loader

Parses the markdown rubric file into structured data.
Can load from file or create programmatically.
"""

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import orjson


@dataclass
class LevelData:
    """A scoring level (e.g., Exemplary, Proficient)."""
    name: str  # exemplary, proficient, developing, inadequate
    min_points: int
    max_points: int
    description: str
    order: int = 0
    
    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "min_points": self.min_points,
            "max_points": self.max_points,
            "description": self.description,
            "order": self.order,
        }


@dataclass
class CriterionData:
    """A criterion within a category."""
    name: str
    points: int
    levels: list[LevelData] = field(default_factory=list)
    description: Optional[str] = None
    order: int = 0
    
    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "points": self.points,
            "description": self.description,
            "order": self.order,
            "levels": [level.to_dict() for level in self.levels],
        }


@dataclass
class CategoryData:
    """A category in the rubric."""
    name: str
    weight: int  # Total points for this category
    criteria: list[CriterionData] = field(default_factory=list)
    description: Optional[str] = None
    order: int = 0
    
    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "weight": self.weight,
            "description": self.description,
            "order": self.order,
            "criteria": [c.to_dict() for c in self.criteria],
        }


@dataclass
class RubricData:
    """Complete rubric structure."""
    name: str
    description: str
    version: str
    total_points: int
    categories: list[CategoryData] = field(default_factory=list)
    
    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "description": self.description,
            "version": self.version,
            "total_points": self.total_points,
            "categories": [c.to_dict() for c in self.categories],
        }
    
    def to_json(self) -> str:
        return orjson.dumps(self.to_dict(), option=orjson.OPT_INDENT_2).decode("utf-8")


def load_rubric_from_markdown(file_path: str | Path) -> RubricData:
    """
    Load rubric from markdown file.
    
    This parser is specifically designed for the rubric.md format.
    """
    path = Path(file_path)
    content = path.read_text(encoding="utf-8")
    
    return parse_rubric_markdown(content)


def parse_rubric_markdown(content: str) -> RubricData:
    """
    Parse rubric markdown content into structured data.
    
    Expected format (from rubric.md):
    - H1: Rubric title
    - H2: "Grading Rubric" section contains categories
    - H3: Category names (e.g., "1. AI Collaboration Process (50 points)")
    - H4: Criterion names (e.g., "Starting Point & Initial Thinking (10 points)")
    - Tables: Level descriptions
    """
    
    # Extract title
    title_match = re.search(r"^#\s+(.+?)$", content, re.MULTILINE)
    title = title_match.group(1) if title_match else "AI-Assisted Writing Rubric"
    
    # Extract description (usually the Philosophy section or subtitle)
    desc_match = re.search(r"^##\s+(?:A )?(.+?)$", content, re.MULTILINE)
    description = desc_match.group(1) if desc_match else "Process-focused assessment rubric"
    
    categories = _parse_categories(content)
    
    # Calculate total points
    total_points = sum(cat.weight for cat in categories)
    
    return RubricData(
        name=title,
        description=description,
        version="1.0",
        total_points=total_points,
        categories=categories,
    )


def _parse_categories(content: str) -> list[CategoryData]:
    """Extract categories from rubric markdown."""
    categories = []
    
    # Find the grading rubric section
    rubric_section_match = re.search(
        r"##\s+Grading Rubric\s*\n(.*?)(?=^##\s+[^#]|\Z)",
        content,
        re.MULTILINE | re.DOTALL
    )
    
    if not rubric_section_match:
        # Try alternative: find sections starting with "### 1."
        rubric_section = content
    else:
        rubric_section = rubric_section_match.group(1)
    
    # Pattern for category headers like "### 1. AI Collaboration Process (50 points)"
    category_pattern = re.compile(
        r"^###\s+(\d+)\.\s+(.+?)\s+\((\d+)\s+points?\)",
        re.MULTILINE | re.IGNORECASE
    )
    
    # Find all categories
    category_matches = list(category_pattern.finditer(rubric_section))
    
    for i, match in enumerate(category_matches):
        order = int(match.group(1))
        name = match.group(2).strip()
        weight = int(match.group(3))
        
        # Get content until next category or end
        start = match.end()
        end = category_matches[i + 1].start() if i + 1 < len(category_matches) else len(rubric_section)
        category_content = rubric_section[start:end]
        
        # Parse criteria within this category
        criteria = _parse_criteria(category_content)
        
        categories.append(CategoryData(
            name=name,
            weight=weight,
            criteria=criteria,
            order=order - 1,  # 0-indexed
        ))
    
    return categories


def _parse_criteria(category_content: str) -> list[CriterionData]:
    """Extract criteria from category content."""
    criteria = []
    
    # Pattern for criterion headers like "#### Starting Point & Initial Thinking (10 points)"
    criterion_pattern = re.compile(
        r"^####\s+(.+?)\s+\((\d+)\s+points?\)",
        re.MULTILINE | re.IGNORECASE
    )
    
    criterion_matches = list(criterion_pattern.finditer(category_content))
    
    for i, match in enumerate(criterion_matches):
        name = match.group(1).strip()
        points = int(match.group(2))
        
        # Get content until next criterion or end
        start = match.end()
        end = criterion_matches[i + 1].start() if i + 1 < len(criterion_matches) else len(category_content)
        criterion_content = category_content[start:end]
        
        # Parse levels from the table
        levels = _parse_levels_from_table(criterion_content, points)
        
        criteria.append(CriterionData(
            name=name,
            points=points,
            levels=levels,
            order=i,
        ))
    
    return criteria


def _parse_levels_from_table(criterion_content: str, max_points: int) -> list[LevelData]:
    """
    Parse scoring levels from markdown table.
    
    Expected table format:
    | **Exemplary (9-10)** | **Proficient (7-8)** | **Developing (5-6)** | **Inadequate (0-4)** |
    |---------------------|---------------------|---------------------|---------------------|
    | Description... | Description... | Description... | Description... |
    """
    levels = []
    
    # Find the table
    table_match = re.search(
        r"\|[^\n]+\|\s*\n\|[\-\|]+\|\s*\n(\|[^\n]+\|)",
        criterion_content,
        re.DOTALL
    )
    
    if not table_match:
        # Create default levels if no table found
        return _create_default_levels(max_points)
    
    # Parse header row for level names and point ranges
    header_match = re.search(r"^\|(.+)\|", criterion_content, re.MULTILINE)
    if not header_match:
        return _create_default_levels(max_points)
    
    headers = header_match.group(1).split("|")
    headers = [h.strip() for h in headers if h.strip()]
    
    # Parse description row
    lines = criterion_content.strip().split("\n")
    desc_line = None
    for line in lines:
        if line.startswith("|") and "---" not in line:
            # Skip the header row
            if any("Exemplary" in h or "Proficient" in h for h in line.split("|")):
                continue
            desc_line = line
            break
    
    if not desc_line:
        return _create_default_levels(max_points)
    
    descriptions = desc_line.split("|")
    descriptions = [d.strip() for d in descriptions if d.strip()]
    
    # Standard level definitions
    level_defs = [
        ("exemplary", 0),
        ("proficient", 1),
        ("developing", 2),
        ("inadequate", 3),
    ]
    
    for i, (level_name, order) in enumerate(level_defs):
        if i >= len(headers):
            break
        
        # Extract point range from header like "Exemplary (9-10)" or "Inadequate (0-4)"
        header = headers[i]
        range_match = re.search(r"\((\d+)[-–](\d+)\)", header)
        
        if range_match:
            min_pts = int(range_match.group(1))
            max_pts = int(range_match.group(2))
        else:
            # Estimate based on position
            min_pts, max_pts = _estimate_point_range(order, max_points)
        
        description = descriptions[i] if i < len(descriptions) else ""
        
        levels.append(LevelData(
            name=level_name,
            min_points=min_pts,
            max_points=max_pts,
            description=description,
            order=order,
        ))
    
    return levels


def _estimate_point_range(order: int, max_points: int) -> tuple[int, int]:
    """Estimate point range based on level order and max points."""
    if max_points <= 5:
        ranges = {0: (5, 5), 1: (4, 4), 2: (2, 3), 3: (0, 1)}
    elif max_points <= 7:
        ranges = {0: (6, 7), 1: (5, 5), 2: (3, 4), 3: (0, 2)}
    elif max_points <= 10:
        ranges = {0: (9, 10), 1: (7, 8), 2: (5, 6), 3: (0, 4)}
    else:  # 15 points
        ranges = {0: (14, 15), 1: (11, 13), 2: (8, 10), 3: (0, 7)}
    
    return ranges.get(order, (0, max_points))


def _create_default_levels(max_points: int) -> list[LevelData]:
    """Create default levels when table parsing fails."""
    if max_points <= 5:
        ranges = [(5, 5), (4, 4), (2, 3), (0, 1)]
    elif max_points <= 7:
        ranges = [(6, 7), (5, 5), (3, 4), (0, 2)]
    elif max_points <= 10:
        ranges = [(9, 10), (7, 8), (5, 6), (0, 4)]
    else:
        ranges = [(14, 15), (11, 13), (8, 10), (0, 7)]
    
    level_names = ["exemplary", "proficient", "developing", "inadequate"]
    
    return [
        LevelData(
            name=name,
            min_points=ranges[i][0],
            max_points=ranges[i][1],
            description=f"{name.title()} performance",
            order=i,
        )
        for i, name in enumerate(level_names)
    ]


def create_default_rubric() -> RubricData:
    """
    Create the default rubric programmatically.
    This matches the structure in rubric.md.
    """
    return RubricData(
        name="AI-Assisted Writing Assignment Rubric",
        description="A Process-Focused Approach (80% Process / 20% Product)",
        version="1.0",
        total_points=100,
        categories=[
            CategoryData(
                name="AI Collaboration Process",
                weight=50,
                order=0,
                criteria=[
                    CriterionData(
                        name="Starting Point & Initial Thinking",
                        points=10,
                        order=0,
                        levels=[
                            LevelData("exemplary", 9, 10, "Demonstrates clear articulation of initial position and research question. Shows genuine uncertainty or curiosity about the topic. Beginning prompts reveal student's own thinking before AI influence.", 0),
                            LevelData("proficient", 7, 8, "States initial position clearly. Shows some original thinking, though may be somewhat generic. Beginning prompts are functional.", 1),
                            LevelData("developing", 5, 6, "Vague or unclear initial position. Prompts show minimal original thought - mostly asks AI to 'write an essay about X.'", 2),
                            LevelData("inadequate", 0, 4, "No clear starting point. Simply asks AI to generate content with no personal input or direction.", 3),
                        ],
                    ),
                    CriterionData(
                        name="Iterative Refinement & Critical Engagement",
                        points=15,
                        order=1,
                        levels=[
                            LevelData("exemplary", 14, 15, "Extensive back-and-forth with AI showing deep engagement. Challenges AI responses, asks for clarification, requests revisions, and pushes for deeper analysis. Clearly directs AI rather than accepting first drafts. Shows 10+ meaningful exchanges.", 0),
                            LevelData("proficient", 11, 13, "Good iterative process with multiple rounds of refinement. Questions some AI outputs and requests improvements. Shows 6-9 meaningful exchanges with clear progression.", 1),
                            LevelData("developing", 8, 10, "Limited iteration. Accepts most AI outputs with minimal questioning. May request minor edits but doesn't push for deeper thinking. Shows 3-5 exchanges.", 2),
                            LevelData("inadequate", 0, 7, "Minimal iteration. Copy-pastes first or second AI response. Little to no refinement or questioning of AI outputs.", 3),
                        ],
                    ),
                    CriterionData(
                        name="Perspective Exploration & Intellectual Honesty",
                        points=15,
                        order=2,
                        levels=[
                            LevelData("exemplary", 14, 15, "Actively seeks out opposing viewpoints and challenges to their thesis. Asks AI to provide counterarguments and steelman opposing positions. Engages with these perspectives thoughtfully - either refuting them with evidence or integrating valid points. Shows evolution of thinking.", 0),
                            LevelData("proficient", 11, 13, "Explores alternative perspectives. Considers some counterarguments. Shows willingness to adjust position based on new information. May not deeply engage with strongest opposing views.", 1),
                            LevelData("developing", 8, 10, "Acknowledges other perspectives exist but doesn't deeply engage with them. Primarily seeks confirmation of original position. Superficial treatment of counterarguments.", 2),
                            LevelData("inadequate", 0, 7, "Only seeks information supporting initial position. Ignores or dismisses opposing viewpoints. Shows no evolution of thinking or intellectual flexibility.", 3),
                        ],
                    ),
                    CriterionData(
                        name="Research & Source Integration",
                        points=10,
                        order=3,
                        levels=[
                            LevelData("exemplary", 9, 10, "Requests specific sources, asks AI to verify claims, fact-checks AI outputs. Integrates research strategically. Demonstrates awareness of AI limitations regarding sources. Independently verifies critical facts.", 0),
                            LevelData("proficient", 7, 8, "Asks for sources and some evidence. Shows awareness that claims need support. Some verification of AI-provided information.", 1),
                            LevelData("developing", 5, 6, "Minimal research requests. Largely accepts AI claims without verification. Few or generic source requests.", 2),
                            LevelData("inadequate", 0, 4, "No research process visible. Accepts all AI outputs as fact. No verification or source-checking evident.", 3),
                        ],
                    ),
                ],
            ),
            CategoryData(
                name="Metacognitive Awareness & Learning",
                weight=20,
                order=1,
                criteria=[
                    CriterionData(
                        name="Process Reflection Quality",
                        points=10,
                        order=0,
                        levels=[
                            LevelData("exemplary", 9, 10, "Demonstrates sophisticated understanding of own learning process. Articulates how AI collaboration changed their thinking. Identifies specific moments of insight or difficulty. Shows awareness of both AI's value and limitations.", 0),
                            LevelData("proficient", 7, 8, "Reflects on learning process with specific examples. Discusses how AI helped and hindered. Shows some self-awareness about the collaboration.", 1),
                            LevelData("developing", 5, 6, "Basic reflection present but may be superficial. Generic statements about AI being 'helpful.' Limited specific examples or insights.", 2),
                            LevelData("inadequate", 0, 4, "No meaningful reflection. Treats AI as merely a writing tool. No evidence of learning or growth through the process.", 3),
                        ],
                    ),
                    CriterionData(
                        name="Intellectual Growth & Position Evolution",
                        points=10,
                        order=1,
                        levels=[
                            LevelData("exemplary", 9, 10, "Chat history shows clear evolution of thinking. Student's position becomes more nuanced, sophisticated, or changes entirely based on research and reasoning. Can articulate why and how views shifted.", 0),
                            LevelData("proficient", 7, 8, "Some evolution visible in chat history. Position shows refinement or deepening. Student acknowledges learning new information that affected their thinking.", 1),
                            LevelData("developing", 5, 6, "Minimal change in position from start to finish. May add detail but fundamental thinking remains static. Limited evidence of new learning.", 2),
                            LevelData("inadequate", 0, 4, "No evolution of thinking. Final position essentially identical to starting position. Appears to use AI only to articulate pre-existing views.", 3),
                        ],
                    ),
                ],
            ),
            CategoryData(
                name="Transparency & Academic Integrity",
                weight=10,
                order=2,
                criteria=[
                    CriterionData(
                        name="Complete Documentation",
                        points=5,
                        order=0,
                        levels=[
                            LevelData("exemplary", 5, 5, "Submits complete, unedited chat history from first prompt to final revision. All AI interactions clearly documented. Timestamps preserved. Nothing omitted.", 0),
                            LevelData("proficient", 4, 4, "Submits comprehensive chat history with minor gaps. Essentially complete documentation of AI collaboration.", 1),
                            LevelData("developing", 3, 3, "Chat history submitted but with noticeable gaps or edited portions. Some interactions may be missing.", 2),
                            LevelData("inadequate", 0, 2, "Incomplete, heavily edited, or suspiciously brief chat history. Appears to have hidden interactions or cherry-picked exchanges.", 3),
                        ],
                    ),
                    CriterionData(
                        name="Honesty & Attribution",
                        points=5,
                        order=1,
                        levels=[
                            LevelData("exemplary", 5, 5, "Crystal clear about what came from AI vs. own thinking. Acknowledges when copying AI language directly. Honest about struggles, mistakes, and false starts in the process.", 0),
                            LevelData("proficient", 4, 4, "Clearly distinguishes AI contributions from personal work. Appropriate attribution. Generally transparent about the process.", 1),
                            LevelData("developing", 3, 3, "Somewhat unclear about AI vs. personal contributions. Attribution may be inconsistent. Some ambiguity about sources of ideas.", 2),
                            LevelData("inadequate", 0, 2, "Presents AI-generated content as entirely own work. Misleading about extent or nature of AI collaboration. Dishonest documentation.", 3),
                        ],
                    ),
                ],
            ),
            CategoryData(
                name="Final Essay Quality",
                weight=20,
                order=3,
                criteria=[
                    CriterionData(
                        name="Coherence & Structure",
                        points=7,
                        order=0,
                        levels=[
                            LevelData("exemplary", 6, 7, "Essay has clear thesis, logical flow, and sophisticated organization. Transitions work smoothly. Reader can follow complex argument easily.", 0),
                            LevelData("proficient", 5, 5, "Clear structure with thesis and supporting points. Generally logical organization. Minor issues with flow or transitions.", 1),
                            LevelData("developing", 3, 4, "Basic structure present but may be formulaic or unclear. Organization issues make argument harder to follow.", 2),
                            LevelData("inadequate", 0, 2, "Poor or absent structure. No clear thesis. Disorganized or incoherent.", 3),
                        ],
                    ),
                    CriterionData(
                        name="Depth & Insight",
                        points=7,
                        order=1,
                        levels=[
                            LevelData("exemplary", 6, 7, "Essay demonstrates genuine insight and original thinking. Goes beyond surface-level analysis. Shows intellectual engagement with complex ideas.", 0),
                            LevelData("proficient", 5, 5, "Solid analysis with some depth. Makes valid points beyond obvious observations. Shows understanding of topic.", 1),
                            LevelData("developing", 3, 4, "Superficial treatment of topic. Mostly surface-level observations. Limited depth or insight.", 2),
                            LevelData("inadequate", 0, 2, "Shallow or incorrect analysis. Misses key points. No meaningful engagement with topic complexity.", 3),
                        ],
                    ),
                    CriterionData(
                        name="Writing Quality",
                        points=6,
                        order=2,
                        levels=[
                            LevelData("exemplary", 5, 6, "Polished prose with clear voice. Minimal errors. Appropriate tone and style. Evidence of careful editing.", 0),
                            LevelData("proficient", 4, 4, "Clear writing with few errors. Appropriate academic style. Generally well-edited.", 1),
                            LevelData("developing", 2, 3, "Functional writing but may be awkward or contain errors. Style inconsistencies. Needs more editing.", 2),
                            LevelData("inadequate", 0, 1, "Poor writing quality. Numerous errors. Inappropriate style or tone. Appears unedited.", 3),
                        ],
                    ),
                ],
            ),
        ],
    )

