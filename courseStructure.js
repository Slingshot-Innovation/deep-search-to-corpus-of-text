// V3: This uses an Instaclass-style curriculum structure to use a broad narrative as basis for search queries. Also generates a script for a video essay based on the search results.

require('dotenv').config();
const OpenAI = require("openai");
const readline = require('readline');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const searchGoogle = async (searchQuery, limit) => {
    const apiKey = process.env.GOOGLE_API_KEY;
    const engineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${engineId}&q=${searchQuery}&num=${limit}`;

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'X-API-Key': apiKey
            }
        });

        const data = await response.json();

        if (!data.items || data.items.length === 0) {
            throw new Error("No search results found.");
        }

        return data.items.map(item => item.title + ": " + item.snippet + " - URL: " + item.link + "\n\n");
    } catch (error) {
        console.error(error);
        return [];
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

async function testCourseStructure(query) {

    const curriculum = await generateSearchStructure(query);

    // For each section, subsection, and query, we will search for the query and provide the user with the results
    const currentResults = await Promise.all(curriculum.sections.map(async (section) => {
        return await Promise.all(section.subsections.map(async (subsection) => {
            return await Promise.all(subsection.queries.map(async (searchQuery, index) => {
                return {
                    title: `${section.title} - ${subsection.title} - Query ${index + 1}`,
                    results: await searchGoogle(searchQuery, 3)
                };
            }
            ));
        }));
    }));

    console.log("Current Results: ", JSON.stringify(currentResults));

    // write current results to a json file
    const fs = require('fs');
    fs.writeFileSync('courseStructure-currentResults.json', JSON.stringify(currentResults));

    
    const messages = [
        {
            role: "system",
            content: `
            The date and time is: ${new Date().toLocaleString()}.
            You are in charge of creating an in-depth response based on the results of the search you conducted for a user.
            Your job is to regurgatate all the relevant information you found in a coherent and structured manner, providing them with the most important and interesting information.
            This user will be taking your response and using it to craft a script for a video essay they are creating.
            Therefore, it is of utmost importance that you provide them with the most relevant and interesting information you found, and as much of it as possible.
            Providing them with a full scope of the information found for each topic and subtopic is crucial so they have all angles to draw from when creating their video essay.
            You should make sure to address the user's original query, and provide them with the most relevant information you found for each topic. 
            Your response should be formatted in markdown.
            You should use # for the main title, ## for the subtitles, and ### for the sub-subtitles then put as much text as you can to provide the user with the most information for that topic under the sub-titles.
            The search results you found are as follows - each set of results will correspond to a different search query:
            ${JSON.stringify(currentResults)}
            `
        },
        {
            role: "user",
            content: `The search query provided was: ${query}`
        }
    ];

    const completion = await openai.chat.completions.create({
        messages,
        model: "gpt-4o",
    });

    return completion.choices[0].message.content;
}

async function writeTestScript(query, corpusdeez) {
    
    const messages = [
        {
            role: "system",
            content: `
            You are in charge of creating a Vox-style video essay script based on the results of the search you conducted for a user.
            Your job is to take the information you provided and craft a script that is engaging, informative, and interesting.
            You should cover all the information in the search results you found, and provide the user with a script that they can use to create a video essay.
            The research to base the script on is: ${corpusdeez}
            `
        },
        {
            role: "user",
            content: `The search query provided was: ${query}. Write the script.`
        }
    ];

    const completion = await openai.chat.completions.create({
        messages,
        model: "gpt-4o",
    });

    return completion.choices[0].message.content;
}

// Set up readline interface
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Prompt the user for input
rl.question('Enter your search query: ', async (query) => {
    try {
        const result = await testCourseStructure(query);
        console.log(result);
        console.log("\n")
        const script = await writeTestScript(query, result);
        // write script to file
        const fs = require('fs');
        fs.writeFileSync('courseStructure-script.md', script);
        console.log("Script", script);
    } catch (error) {
        console.error('An error occurred:', error);
    } finally {
        rl.close();
    }
});
