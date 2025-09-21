#!/usr/bin/env node

// Test the new human-friendly response format
function testHumanFriendlyResponse() {
  console.log('🧪 Testing Human-Friendly Fact-Check Response\n');
  
  const botResponses = {
    factCheckComplete: (claim, analysis) => {
      const sourceText = analysis.sources && analysis.sources > 1 ? `${analysis.sources} sources` : "multiple sources";
      const verdictIcon = analysis.verdict === 'True' ? '✅' : analysis.verdict === 'False' ? '❌' : '⚠️';
      const confidenceIcon = analysis.confidence === 'High' ? '🎯' : analysis.confidence === 'Medium' ? '📊' : '🤔';
      
      const verdictText = analysis.verdict === 'True' ? 'This appears to be true' : analysis.verdict === 'False' ? 'This appears to be false' : 'The evidence is mixed';
      
      return `${verdictIcon} ${verdictText}! I found this information across ${sourceText} including major news outlets and fact-checkers.

${analysis.verdict === 'True' ? '✅' : analysis.verdict === 'False' ? '❌' : '⚠️'} The sources generally ${analysis.verdict === 'True' ? 'confirm' : analysis.verdict === 'False' ? 'contradict' : 'have mixed views on'} this claim.

${confidenceIcon} I'm ${analysis.confidence.toLowerCase()}ly confident in this assessment.

💬 Want more details? Just ask "tell me more"!`;
    }
  };
  
  // Test different scenarios
  const testCases = [
    {
      name: "TRUE claim",
      analysis: { verdict: "True", confidence: "High", sources: 4 },
      claim: "Test true claim"
    },
    {
      name: "FALSE claim", 
      analysis: { verdict: "False", confidence: "High", sources: 3 },
      claim: "Test false claim"
    },
    {
      name: "MIXED evidence",
      analysis: { verdict: "Mixed", confidence: "Medium", sources: 5 },
      claim: "Test mixed claim"
    }
  ];
  
  testCases.forEach((testCase, index) => {
    console.log(`${index + 1}. ${testCase.name}:`);
    console.log('=' .repeat(50));
    const response = botResponses.factCheckComplete(testCase.claim, testCase.analysis);
    console.log(response);
    console.log('=' .repeat(50));
    console.log('');
  });
  
  console.log('🎯 COMPARISON:');
  console.log('');
  console.log('❌ OLD (robotic):');
  console.log('"❌ Found in multiple sources: 1. www.reddit.com..."');
  console.log('');
  console.log('✅ NEW (human-friendly):');
  console.log('"❌ This appears to be false! I found this information across multiple sources..."');
  console.log('');
  console.log('🎉 Much more natural and conversational!');
}

testHumanFriendlyResponse();
