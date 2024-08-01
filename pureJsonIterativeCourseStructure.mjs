// V5: This uses an Instaclass-style curriculum structure to use a broad narrative as basis for search queries but then iterates on the first set of results it gets to cover more bases. Also generates a script for a video essay based on the search results.
// Should be the same as V4 but uses pure json instead of markdown as markdown was annoying and lowkey useless.

// OK i think this one is really good. fingers crossed.

import { config } from 'dotenv';
import { extract } from '@extractus/article-extractor'
import OpenAI from "openai";
import readline from 'readline';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const searchGoogle = async (searchQuery, limit) => {
    const apiKey = process.env.GOOGLE_API_KEY;
    const engineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${engineId}&q=${searchQuery}&num=${limit}`;

    try {
        const response = await axios.get(url);
        const data = response.data;

        if (!data.items || data.items.length === 0) {
            throw new Error("No search results found.");
        }

        const results = await Promise.all(data.items.map(async (item) => {
            const content = await fetchPageContent(item.link);
            return {
                title: item.title,
                snippet: item.snippet,
                url: item.link,
                content: content
            };
        }));

        return results;
    } catch (error) {
        console.error(error);
        return [];
    }
};

const fetchPageContent = async (url) => {
    try {
        const article = await extract(url)
        if (!article) {
            console.log(`Error fetching content from ${url}`);
            return `Unable to fetch content from ${url}. Ignore this one.`;
        }
        // Extract the main content (this may need to be adjusted based on the website structure)
        return article.content;
    } catch (error) {
        console.error(`Error fetching content from ${url}:`, error.message);
        return `Unable to fetch content from ${url}`;
    }
};

const refineCurriculum = async (curriculum, initialResults, originalQuery) => {
    const messages = [
        {
            role: "system",
            content: `You are an expert at curriculum design and information retrieval. Your task is to analyze the initial search results and suggest refinements to the curriculum structure. 
            Consider adding new sections, subsections, or queries that would provide more comprehensive coverage of the topic. 
            Also, identify areas where the initial search might have missed important information or where results were not satisfactory.
            Your response should be in the same JSON format as the original curriculum structure.`
        },
        {
            role: "user",
            content: `Original query: ${originalQuery}
            Initial curriculum: ${JSON.stringify(curriculum)}
            Initial search results: ${JSON.stringify(initialResults)}`
        }
    ];

    console.log("OpenAI Input length (refineCurriculum):", JSON.stringify(messages).length);

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages,
        });

        console.log("OpenAI Output length (refineCurriculum):", completion.choices[0].message.content.length);

        return JSON.parse(completion.choices[0].message.content).curriculum || curriculum;
    } catch (error) {
        console.error("Error refining curriculum:", error);
        return curriculum;
    }
};


const generateSearchStructure = async (searchQuery) => {
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
    });

    const queriesResponse = {
        curriculum: {
            title: "Curriculum Title",
            sections: [
                {
                    title: "Section Title",
                    subsections: [
                        {
                            title: "Subsection Title",
                            queries: ["search term 1", "search term 2", "search term 3", "etc..."],
                            explanations: ["explanation 1", "explanation 2", "explanation 3", "etc..."]
                        }
                    ]
                },
                {
                    title: "Section Title",
                    subsections: [
                        {
                            title: "Subsection Title",
                            queries: ["search term 1", "search term 2", "search term 3", "etc..."],
                            explanations: ["explanation 1", "explanation 2", "explanation 3", "etc..."]
                        }
                    ]
                }
            ]
        }
    };

    const messages = [
        {
            role: "system",
            content: `You are in charge of creating a class curriculum structure for a user's given search query.
            You need to create a curriculum to educate a user on the topic they are searching for.
            Your skill here is uncovering information that the user doesn't currently know exists on the internet.
            Through your construction of the course, and the search queries you generate, you will be able to provide the user with a comprehensive understanding of the topic that they could not get without you
            Your job is to best model your queries based on how you imagine a human with full access to the internet would search.
            This means that you should continuously dig deeper in a direction that gets you more information which would be required to find the information needed by the user.
            This also means that the search query should be concise and consist of only the required key words to get the most relevant results.
            For each query, you will have to also provide a short one line explanation of why you chose that query.
            You should generate a number of queries, but they should all be different ways of searching for the same information.
            For example, if the query is "Lebanese YC Founders", you might want to do YC Lebanese Founders, Lebanon Founders YC, YC Lebanon LinkedIn, etc...
            Make use of relevant websites for a given query - for example, if the query is about Lebanese YC Founders, you might want to search on LinkedIn, Crunchbase.
            For experiences of people, you might want to have queries for Reddit, Quora, etc.
            For reviews, you might want to have queries for Yelp, Google Reviews, etc.
            You should go down paths, but if it feels like you are going too far down a rabbit hole, you should try to come back up and explore other paths. You should also try to explore paths that are adjacent to the current path you are on, as they might be relevant.
            Your response should be in JSON format: ${JSON.stringify(queriesResponse)}`
        },
        {
            role: "user",
            content: `The initial search query provided by the user is: ${searchQuery}`
        },
    ];

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages,
            response_format: { type: "json_object" }
        });

        if (completion.choices && completion.choices.length > 0) {
            const curriculum = JSON.parse(completion.choices[0].message.content).curriculum || { sections: [{ subsections: [{ queries: [searchQuery] }] }] };
            console.log("Curriculum: ", JSON.stringify(curriculum.sections));
            return curriculum;
        }
    } catch (error) {
        console.error(error);
        return [searchQuery];
    }
};

async function performSearch(curriculum) {
    return await Promise.all(curriculum.sections.map(async (section) => {
        return await Promise.all(section.subsections.map(async (subsection) => {
            return await Promise.all(subsection.queries.map(async (searchQuery, index) => {
                return {
                    title: `${section.title} - ${subsection.title} - Query ${index + 1}`,
                    query: searchQuery,
                    results: await searchGoogle(searchQuery, 3)
                };
            }));
        }));
    }));
}

async function generateFinalResponse(query, allResults) {
    let fullResponse = {
        title: `Comprehensive Research on: ${query}`,
        sections: []
    };

    for (const section of allResults) {
        console.log(`Section ${allResults.indexOf(section) + 1} of ${allResults.length}`);
        const sectionTitle = section[0][0].title.split(' - ')[0];
        let currentSection = {
            title: sectionTitle,
            subsections: []
        };

        for (const subsection of section) {
            console.log(`Subsection ${section.indexOf(subsection) + 1} of ${section.length}`);
            const subsectionTitle = subsection[0].title.split(' - ')[1];
            let currentSubsection = {
                title: subsectionTitle,
                queries: []
            };

            for (const query of subsection) {
                const truncatedContent = query.results.map(result => ({
                    title: result.title,
                    snippet: result.snippet,
                    url: result.url,
                    content: result.content.substring(0, 4000)
                }));

                const messages = [
                    {
                        role: "system",
                        content: `
                        You are creating a detailed research summary for a specific query within a subsection of a larger topic.
                        Provide a comprehensive overview of the information found, ensuring to cover all important aspects.
                        Be concise but informative.
                        `
                    },
                    {
                        role: "user",
                        content: `Summarize the following query results for "${query.query}": ${JSON.stringify(truncatedContent)}`
                    }
                ];
                console.log("OpenAI Input (generateFinalResponse):", JSON.stringify(messages).length);

                const completion = await openai.chat.completions.create({
                    messages,
                    model: "gpt-4o",
                    max_tokens: 4000
                });

                console.log("OpenAI Output (generateFinalResponse):", JSON.stringify(completion.choices[0].message.content).length);

                currentSubsection.queries.push({
                    query: query.query,
                    summary: completion.choices[0].message.content
                });
            }
            currentSection.subsections.push(currentSubsection);
        }
        fullResponse.sections.push(currentSection);
    }

    return fullResponse;
}

async function writeTestScript(query, structure, researchContent) {
    let fullScript = `# Video Essay Script: ${query}\n\n`;

    for (const section of researchContent.sections) {
        fullScript += `## ${section.title}\n\n`;

        for (const subsection of section.subsections) {
            console.log(`Processing subsection: ${subsection.title}`);

            const messages = [
                {
                    role: "system",
                    content: `
                    You are writing a portion of a script for a Vox-style video essay based on provided research.
                    Your task is to write an engaging, informative, and interesting script segment using the given content.
                    The script should flow naturally and be suitable for a video presentation.
                    The user will be reading your response word-for-word in the video. Therefore there is no need to include any stage directions, titles, placeholders, or any other meta information.
                    Be informative and draw from the research.
                    `
                },
                {
                    role: "user",
                    content: `The video is on "${query}". The overall structure of the video will be: ${structure}.
                    Write the next portion of the script for the subsection "${subsection.title}" using the following research:
                    ${JSON.stringify(subsection)}`
                }
            ];

            console.log("OpenAI Input (writeTestScript):", JSON.stringify(messages).length);

            const completion = await openai.chat.completions.create({
                messages,
                model: "gpt-4o",
                max_tokens: 4000
            });

            console.log("OpenAI Output (writeTestScript):", JSON.stringify(completion.choices[0].message.content).length);

            fullScript += `### ${subsection.title}\n\n${completion.choices[0].message.content}\n\n`;
        }
    }

    return fullScript;
}

async function removeDuplicateInfo(script) {
    const messages = [
        {
            role: "system",
            content: `
            You are in charge of refining a script for a Vox-style video essay.
            Your task is to analyze the script and remove any duplicate information or repetitive content.
            You should return the script exactly as it was but with the lines that contain duplicate information removed.
            There is no need to rewrite any of the content, please just remove the duplicates.
            Be specific with what you remove. For example, if a high level explanation of a concept is repeated in multiple places, you should remove all but one of those explanations.
            However, if the same concept is explained in different ways, you should keep all of those explanations.
            Equally, if there is a whole section that dives deep into that topic, you should keep that deep dive as it does more than just repeat the high level explanation.
            `
        },
        {
            role: "user",
            content: `The script you are refining is: ${script}`
        }
    ];

    console.log("OpenAI Input (removeDuplicateInfo):", JSON.stringify(messages).length);

    const completion = await openai.chat.completions.create({
        messages,
        model: "gpt-4o",
    });

    console.log("OpenAI Output (removeDuplicateInfo):", JSON.stringify(completion.choices[0].message.content).length);

    return completion.choices[0].message.content;
}

async function testCourseStructure(query) {
    const curriculum = await generateSearchStructure(query);
    const initialResults = await performSearch(curriculum);
    const refinedCurriculum = await refineCurriculum(curriculum, initialResults, query);
    const refinedResults = await performSearch(refinedCurriculum);
    // const allResults = [...initialResults, ...refinedResults];
    const allResults = refinedResults;

    const researchContent = await generateFinalResponse(query, allResults);
    console.log("Completed research content generation.");
    // Write researchContent to file in JSON format
    // fs.writeFileSync(`outputs/${query}/research.json`, JSON.stringify(researchContent, null, 2));

    const outputDir = path.join('outputs', query);
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, 'research.json'), JSON.stringify(researchContent, null, 2));


    const script = await writeTestScript(query, JSON.stringify(curriculum), researchContent);
    const shortenedScript = await removeDuplicateInfo(script);
    return { researchContent, script, shortenedScript };
}

// Set up readline interface
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Prompt the user for input
rl.question('Enter your search query: ', async (query) => {
    try {
        const { researchContent, script, shortenedScript } = await testCourseStructure(query);

        // Write script to file
        // fs.writeFileSync(`outputs/${query}/script.md`, script);

        const outputDir = path.join('outputs', query);
        fs.mkdirSync(outputDir, { recursive: true });

        // Write script to file
        fs.writeFileSync(path.join(outputDir, 'script.md'), script);

        // Write shortened script to file
        fs.writeFileSync(path.join(outputDir, 'shortened-script.md'), shortenedScript);

        // console log difference in length between script and shortened script
        console.log("Length of original script:", script.length);
        console.log("Length of shortened script:", shortenedScript.length);
        console.log("Reduction in length:", script.length - shortenedScript.length, "characters");

        console.log("Completed script generation on ", query);
    } catch (error) {
        console.error('An error occurred:', error);
    } finally {
        rl.close();
    }
});
