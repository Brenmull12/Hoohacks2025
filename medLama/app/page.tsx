"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Send, User, ArrowRight, Moon, Sun, Stethoscope, Video, Clock, ArrowLeft } from "lucide-react";
import { SeverityIndicator } from "@/components/severity-indicator";
import { DoctorList } from "@/components/doctor-list";
import { EmergencyPanel } from "@/components/emergency-panel";
import { SymptomSuggestions } from "@/components/symptom-suggestions";
import { analyzeSymptoms, findAvailableDoctors } from "@/lib/analysis";
import { getEmergencyInfo } from "@/lib/emergency";
import { getSuggestedSymptoms } from "@/lib/symptoms";
import { useTheme } from "next-themes";
import type { SymptomAnalysis, DoctorMatch, SymptomSuggestion } from "@/lib/types";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  lastMessage: string;
  date: Date;
  messages: Message[];
}

type Stage = "chat" | "analysis" | "doctors" | "history";

const LamaLogo = () => (
  <div className="relative group">
    <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-green-500/20 rounded-full blur ai-thinking"></div>
    <div className="relative z-10 rounded-full bg-primary/10 p-2 transition-transform group-hover:scale-110">
      <div className="relative">
        <Bot className="h-6 w-6 text-primary" />
        <Stethoscope className="h-4 w-4 text-primary absolute -top-1 -right-1 transform rotate-45" />
      </div>
    </div>
  </div>
);

// Sample conversation starters to make the chat more interactive
const conversationStarters = [
  "I've been having chest pain for the last few days.",
  "My throat feels sore and I have a slight fever.",
  "I've been getting headaches more frequently lately.",
  "My skin has developed a rash that won't go away.",
  "I'm feeling unusually tired all the time."
];

// List of possible doctor specializations with descriptions
const specializations = {
  "Cardiologist": "Heart and blood vessel specialist",
  "Dermatologist": "Skin, hair, and nail specialist",
  "Neurologist": "Brain and nervous system specialist",
  "Gastroenterologist": "Digestive system specialist",
  "Orthopedist": "Bone and joint specialist",
  "Pulmonologist": "Lung and respiratory specialist",
  "Endocrinologist": "Hormone and metabolism specialist",
  "Rheumatologist": "Autoimmune and joint disease specialist",
  "Psychiatrist": "Mental health specialist",
  "ENT": "Ear, nose, and throat specialist"
};

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hello! I'm your AI health assistant powered by MedLama. How can I help you today? Feel free to describe any symptoms or health concerns you're experiencing.",
    },
  ]);
  const [input, setInput] = useState("");
  const [stage, setStage] = useState<Stage>("chat");
  const [analysis, setAnalysis] = useState<SymptomAnalysis | null>(null);
  const [doctors, setDoctors] = useState<DoctorMatch[]>([]);
  const [isReadyForAnalysis, setIsReadyForAnalysis] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDimmed, setIsDimmed] = useState(false);
  const [suggestions, setSuggestions] = useState<SymptomSuggestion[]>([]);
  const [showConversationStarters, setShowConversationStarters] = useState(true);
  const { theme, setTheme } = useTheme();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsDimmed(isProcessing);
  }, [isProcessing]);

  useEffect(() => {
    if (input.length > 2) {
      const newSuggestions = getSuggestedSymptoms(input);
      setSuggestions(newSuggestions);
    } else {
      setSuggestions([]);
    }
  }, [input]);

  useEffect(() => {
    // Scroll to bottom when messages change
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Load conversations from localStorage on initial load
  useEffect(() => {
    const savedConversations = localStorage.getItem('medlama-conversations');
    if (savedConversations) {
      try {
        const parsed = JSON.parse(savedConversations);
        // Convert date strings back to Date objects
        const conversationsWithDates = parsed.map((conv: any) => ({
          ...conv,
          date: new Date(conv.date)
        }));
        setConversations(conversationsWithDates);
      } catch (e) {
        console.error("Error loading conversations:", e);
      }
    }
  }, []);

  // Save conversations to localStorage when they change
  useEffect(() => {
    if (conversations.length > 0) {
      localStorage.setItem('medlama-conversations', JSON.stringify(conversations));
    }
  }, [conversations]);

  // Generate more conversational responses based on user input
  const generateResponse = (userMessage: string): string => {
    // Extract potential symptoms or concerns from the message
    const lowerMessage = userMessage.toLowerCase();
    
    // Check for certain keywords to generate relevant responses
    if (lowerMessage.includes("pain") || lowerMessage.includes("hurt")) {
      return "I'm sorry to hear you're in pain. Could you tell me more about where it hurts and how severe the pain is? Is it sharp, dull, or throbbing? Does anything make it better or worse?";
    }
    
    if (lowerMessage.includes("fever") || lowerMessage.includes("temperature")) {
      return "A fever can be a sign your body is fighting an infection. Have you measured your temperature? Are you experiencing any other symptoms along with the fever, like chills, sweating, or fatigue?";
    }
    
    if (lowerMessage.includes("headache") || lowerMessage.includes("migraine")) {
      return "Headaches can be quite disruptive. Is this a new type of headache for you or something you've experienced before? Where exactly is the pain located, and does light or sound affect it?";
    }
    
    if (lowerMessage.includes("rash") || lowerMessage.includes("skin")) {
      return "Skin issues can be concerning. Can you describe what the rash looks like? Is it itchy, painful, or changing in appearance? Have you started using any new products recently that might be causing a reaction?";
    }
    
    if (lowerMessage.includes("tired") || lowerMessage.includes("fatigue") || lowerMessage.includes("exhausted")) {
      return "Fatigue can impact your quality of life significantly. Has this tiredness come on suddenly or gradually? Are you getting enough sleep, and has your sleep quality changed recently? Any other symptoms accompanying the fatigue?";
    }
    
    if (lowerMessage.includes("stress") || lowerMessage.includes("anxiety") || lowerMessage.includes("depression")) {
      return "I appreciate you sharing your mental health concerns. How long have you been feeling this way? Are there specific situations that trigger these feelings? Have you noticed any physical symptoms alongside these emotional experiences?";
    }
    
    if (lowerMessage.includes("cough") || lowerMessage.includes("cold") || lowerMessage.includes("flu")) {
      return "Respiratory symptoms can be uncomfortable. Is your cough dry or productive with phlegm? Have you noticed any fever, shortness of breath, or other symptoms? How long have you been experiencing these symptoms?";
    }
    
    if (lowerMessage.includes("stomach") || lowerMessage.includes("nausea") || lowerMessage.includes("vomit")) {
      return "Digestive issues can be quite disruptive. When did these symptoms start? Have you noticed any patterns with certain foods? Are you experiencing any other symptoms like fever or pain alongside the digestive issues?";
    }

    // If no specific concerns detected, ask general follow-up questions
    const generalResponses = [
      "Thank you for sharing that. How long have you been experiencing these symptoms?",
      "I see. Has anything made these symptoms better or worse?",
      "That's important information. Have you had any similar experiences in the past?",
      "I understand. Are you currently taking any medications that might be relevant?",
      "Thanks for explaining. Have these symptoms been affecting your daily activities or sleep?",
      "I appreciate you sharing this. Have you noticed any patterns in when these symptoms appear?"
    ];
    
    return generalResponses[Math.floor(Math.random() * generalResponses.length)];
  };

  const createNewConversation = () => {
    const newId = Date.now().toString();
    const newConversation: Conversation = {
      id: newId,
      title: "New Consultation",
      lastMessage: "Started a new health consultation",
      date: new Date(),
      messages: [
        {
          role: "assistant",
          content: "Hello! I'm your AI health assistant powered by MedLama. How can I help you today? Feel free to describe any symptoms or health concerns you're experiencing.",
        }
      ]
    };
    
    setConversations(prev => [newConversation, ...prev]);
    setCurrentConversationId(newId);
    setMessages(newConversation.messages);
    setStage("chat");
    setIsReadyForAnalysis(false);
    setAnalysis(null);
    setShowConversationStarters(true);
  };

  const handleStarterSelect = (starter: string) => {
    setInput(starter);
    setShowConversationStarters(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { role: "user" as const, content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setSuggestions([]);
    setIsProcessing(true);
    setShowConversationStarters(false);

    // Determine a contextual response based on the user's message
    const aiResponse = {
      role: "assistant" as const,
      content: generateResponse(input)
    };

    // Update conversation in storage
    if (currentConversationId) {
      setConversations(prev => {
        return prev.map(conv => {
          if (conv.id === currentConversationId) {
            // Extract first 30 characters for title if this is the first user message
            const isFirstMessage = conv.messages.filter(m => m.role === "user").length === 0;
            return {
              ...conv,
              title: isFirstMessage ? input.substring(0, 30) + (input.length > 30 ? "..." : "") : conv.title,
              lastMessage: input,
              messages: [...conv.messages, userMessage],
              date: new Date()
            };
          }
          return conv;
        });
      });
    } else {
      // Create new conversation if one doesn't exist
      const newId = Date.now().toString();
      const newConversation: Conversation = {
        id: newId,
        title: input.substring(0, 30) + (input.length > 30 ? "..." : ""),
        lastMessage: input,
        date: new Date(),
        messages: [messages[0], userMessage]
      };
      
      setConversations(prev => [newConversation, ...prev]);
      setCurrentConversationId(newId);
    }

    // After 2 exchanges, show the analysis button
    setTimeout(() => {
      setMessages((prev) => [...prev, aiResponse]);
      setIsProcessing(false);
      
      // Update the conversation with the AI response
      if (currentConversationId) {
        setConversations(prev => {
          return prev.map(conv => {
            if (conv.id === currentConversationId) {
              return {
                ...conv,
                messages: [...conv.messages, aiResponse],
              };
            }
            return conv;
          });
        });
      }
      
      // After a few exchanges, suggest analysis
      const userMessageCount = messages.filter(m => m.role === "user").length;
      if (userMessageCount >= 1) {
        setIsReadyForAnalysis(true);
      }
    }, 1000);
  };

  const handleAnalysis = async () => {
    setIsProcessing(true);
    const symptoms = messages
      .filter((msg) => msg.role === "user")
      .map((msg) => msg.content)
      .join(" ");

    try {
      // Simulated analysis result - in a real app, this would come from a backend
      const result = {
        severity: "moderate" as "moderate", // Explicitly cast to the expected literal type
        recommendations: [
          "Stay hydrated and get plenty of rest",
          "Monitor your symptoms for the next 48 hours",
          "Consider over-the-counter pain relievers if needed",
          "Schedule a follow-up with a specialist if symptoms persist"
        ],
        suggestedSpecialists: ["Cardiologist", "Internal Medicine"],
        possibleConditions: ["Stress-related symptoms", "Mild hypertension", "Anxiety"],
        emergencyInfo: null
      };

      // Even for medium/low risk, show hospital options
      const emergencyInfo = {
        nearbyHospitals: [
          { name: "City General Hospital", distance: "2.3 miles", address: "123 Health Ave" },
          { name: "University Medical Center", distance: "4.1 miles", address: "500 Medical Blvd" },
          { name: "Community Health Clinic", distance: "1.8 miles", address: "78 Wellness St" }
        ],
        emergencyNumber: "911"
      };
      
      result.emergencyInfo = emergencyInfo;
      
      // Fetch tailored follow-up questions using Gemini API
      try {
        const response = await fetch('/api/gemini/follow-up', {
          method: 'POST',
          headers: {
        'Content-Type': 'application/json',
          },
          body: JSON.stringify({ symptoms }),
        });

        if (response.ok) {
          const followUpQuestions = await response.json();
          result.followUpQuestions = followUpQuestions;
        } else {
          console.error('Failed to fetch follow-up questions from Gemini API');
        }
      } catch (error) {
        console.error('Error fetching follow-up questions:', error);
      }

      // Check if the user has already been asked follow-up questions
      const hasFollowUpQuestions = messages.some(
        (msg) =>
          msg.role === "assistant" &&
          result.followUpQuestions &&
          result.followUpQuestions.includes(msg.content)
      );

      if (!hasFollowUpQuestions && result.followUpQuestions) {
        const followUpQuestion = result.followUpQuestions[0];
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: followUpQuestion },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
        role: "assistant",
        content:
          "Would you like me to analyze your symptoms and provide recommendations?",
          },
        ]);
      }

      setAnalysis(result);

      // Add a slight delay to simulate processing and make it feel interactive
      setTimeout(() => {
        setStage("analysis");
      }, 500);

      // Add a subtle animation to indicate transition
      document.body.classList.add("transitioning");
      setTimeout(() => {
        document.body.classList.remove("transitioning");
      }, 1000);

      // Create more detailed doctor information with specializations
      const doctorsWithSpecializations = [
        {
          name: "Dr. Sarah Johnson",
          specialty: "Cardiologist",
          description: specializations["Cardiologist"],
          image: "/images/doctor1.jpg",
          nextAvailable: "Tomorrow, 2:30 PM",
          rating: 4.9,
          distance: "3.2 miles"
        },
        {
          name: "Dr. Michael Chen",
          specialty: "Cardiologist",
          description: specializations["Cardiologist"],
          image: "/images/doctor2.jpg",
          nextAvailable: "Thursday, 10:15 AM",
          rating: 4.7,
          distance: "1.8 miles"
        },
        {
          name: "Dr. Emily Rodriguez",
          specialty: "Internal Medicine",
          description: "General health and preventive care specialist",
          image: "/images/doctor3.jpg",
          nextAvailable: "Today, 4:45 PM",
          rating: 4.8,
          distance: "2.5 miles"
        }
      ];
      
      setDoctors(doctorsWithSpecializations);
      setStage("analysis");
    } catch (error) {
      console.error("Error analyzing symptoms or finding doctors:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSuggestionSelect = (symptom: string) => {
    setInput((prev) => prev + (prev ? `, ${symptom}` : symptom));
  };

  const handleEmergencyCall = () => {
    alert("This is a local environment. Emergency call simulation triggered.");
  };

  const loadConversation = (conversationId: string) => {
    const conversation = conversations.find(c => c.id === conversationId);
    if (conversation) {
      setMessages(conversation.messages);
      setCurrentConversationId(conversationId);
      setStage("chat");
      setIsReadyForAnalysis(true);
      setShowConversationStarters(false);
    }
  };

  const Header = () => (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-3">
          <LamaLogo />
          <div>
            <span className="text-xl font-semibold bg-gradient-to-r from-primary via-green-500 to-emerald-500 bg-clip-text text-transparent">
              MedLama
            </span>
            <span className="text-xs text-muted-foreground block">AI-Powered Health Assistant</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStage(stage === "history" ? "chat" : "history")}
            className="rounded-full hover:bg-secondary/80"
          >
            <Clock className="h-5 w-5 mr-1" />
            <span className="hidden sm:inline">History</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="rounded-full hover:bg-secondary/80"
          >
            {theme === "dark" ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>
    </header>
  );

  // History view
  if (stage === "history") {
    return (
      <div className="flex min-h-screen flex-col bg-background hexagon-bg">
        <Header />
        <main className="flex flex-1 flex-col items-center p-4 md:p-8">
          <Card className="w-full max-w-4xl p-6 shadow-lg glass-card">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-green-600 bg-clip-text text-transparent">
                Consultation History
              </h2>
              <Button onClick={createNewConversation} className="rounded-full">
                New Consultation
              </Button>
            </div>
            
            {conversations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No previous consultations found.</p>
                <Button onClick={createNewConversation} className="mt-4">
                  Start your first consultation
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {conversations.map(conv => (
                  <div 
                    key={conv.id}
                    className="p-4 border rounded-lg hover:bg-secondary/20 cursor-pointer transition-colors"
                    onClick={() => loadConversation(conv.id)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium">{conv.title}</h3>
                        <p className="text-sm text-muted-foreground truncate max-w-md">
                          {conv.lastMessage}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {conv.date.toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </main>
      </div>
    );
  }

  // Analysis view
  if (stage === "analysis" && analysis) {
    return (
      <div className="flex min-h-screen flex-col bg-background hexagon-bg">
        <Header />
        <main className="flex flex-1 flex-col items-center p-4 md:p-8">
          <Card className="w-full max-w-4xl p-6 shadow-lg glass-card">
            <div className="flex items-center mb-6">
              <Button 
                variant="ghost" 
                className="mr-2 rounded-full" 
                onClick={() => setStage("chat")}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Chat
              </Button>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-green-600 bg-clip-text text-transparent">
                Symptom Analysis
              </h2>
            </div>
            
            <SeverityIndicator severity={analysis.severity} />
            
            {analysis.emergencyInfo && (
              <div className="mt-6">
                <h3 className="text-xl font-semibold mb-3">Nearby Medical Facilities</h3>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {analysis.emergencyInfo.nearbyHospitals.map((hospital, idx) => (
                    <div key={idx} className="border rounded-lg p-4 bg-card/50 hover:shadow-md transition-shadow">
                      <h4 className="font-medium">{hospital.name}</h4>
                      <p className="text-sm text-muted-foreground">{hospital.address}</p>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-xs bg-secondary/50 px-2 py-1 rounded-full">
                          {hospital.distance}
                        </span>
                        <Button variant="outline" size="sm" className="text-xs">
                          Get Directions
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-8">
              <h3 className="text-xl font-semibold mb-4">Possible Conditions</h3>
              <div className="flex flex-wrap gap-2">
                {analysis.possibleConditions.map((condition, i) => (
                  <span key={i} className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm">
                    {condition}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-8">
              <h3 className="text-xl font-semibold mb-4">Recommendations</h3>
              <ul className="space-y-3">
                {analysis.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-center text-muted-foreground">
                    <span className="mr-3 text-primary">•</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-8">
              <h3 className="text-xl font-semibold mb-4">Recommended Specialists</h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {doctors.map((doctor, idx) => (
                  <div key={idx} className="border rounded-lg p-4 bg-card/50 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
                        <User className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-medium">{doctor.name}</h4>
                        <p className="text-xs text-primary">{doctor.specialty}</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">{doctor.description}</p>
                    <div className="flex justify-between items-center text-xs text-muted-foreground mb-3">
                      <span>Next available: {doctor.nextAvailable}</span>
                      <span>{doctor.distance}</span>
                    </div>
                    <Button size="sm" className="w-full">
                      Schedule Appointment
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between mt-8">
              <Button 
                onClick={() => setStage("chat")}
                variant="outline"
              >
                Continue Chat
              </Button>
              <Button 
                onClick={createNewConversation}
                variant="default"
              >
                New Consultation
              </Button>
            </div>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background hexagon-bg">
      <Header />
      <main className="flex flex-1 flex-col items-center p-4 md:p-8">
        <Card className={`flex h-[80vh] w-full max-w-4xl flex-col shadow-lg glass-card transition-opacity duration-300 ${isDimmed ? 'opacity-95' : ''}`}>
          <ScrollArea className="flex-1 p-4 chat-container">
            <div className="space-y-4">
              {messages.map((message, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-4 message-fade-in ${
                    message.role === "assistant" ? "flex-row" : "flex-row-reverse"
                  }`}
                >
                  <div className={`rounded-full p-2 ${
                    message.role === "assistant" 
                      ? "bg-primary/10" 
                      : "bg-secondary"
                  }`}>
                    {message.role === "assistant" ? (
                      <Bot className="h-6 w-6 text-primary" />
                    ) : (
                      <User className="h-6 w-6" />
                    )}
                  </div>
                  <div
                    className={`rounded-lg px-4 py-3 ${
                      message.role === "assistant"
                        ? "bg-card/50 border shadow-sm backdrop-blur-sm"
                        : "bg-primary text-primary-foreground"
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              ))}
              {isProcessing && (
                <div className="flex items-center gap-2 text-muted-foreground processing">
                  <Bot className="h-5 w-5" />
                  <span>Thinking...</span>
                </div>
              )}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>

          <div className="border-t p-4 space-y-4 bg-background/50 backdrop-blur-sm">
            {showConversationStarters && messages.length <= 2 && (
              <div className="mb-4">
                <p className="text-xs text-muted-foreground mb-2">Quick start with common concerns:</p>
                <div className="flex flex-wrap gap-2">
                  {conversationStarters.map((starter, idx) => (
                    <Button 
                      key={idx} 
                      variant="outline" 
                      size="sm" 
                      className="text-xs rounded-full"
                      onClick={() => handleStarterSelect(starter)}
                    >
                      {starter}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            
            {suggestions.length > 0 && (
              <SymptomSuggestions 
                suggestions={suggestions} 
                onSelect={handleSuggestionSelect} 
              />
            )}
            
            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-2"
            >
              <Input
                placeholder="Describe what you're feeling..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="flex-1 rounded-full bg-secondary/50"
              />
              <Button 
                type="submit" 
                size="icon" 
                className="rounded-full hover:glow-effect"
                disabled={isProcessing}
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>

            {isReadyForAnalysis && (
              <Button
                className="w-full mt-4 rounded-full hover:glow-effect"
                onClick={handleAnalysis}
                variant="default"
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <span className="flex items-center gap-2">
                    <Bot className="h-4 w-4 animate-spin" />
                    Analyzing Symptoms...
                  </span>
                ) : (
                  <>
                    Analyze Symptoms
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            )}

            <Button
              className="w-full mt-4 rounded-full hover:glow-effect"
              onClick={() => alert("Teleconsultation feature coming soon!")}
              variant="outline"
            >
              <span className="flex items-center gap-2">
                <Video className="h-4 w-4" />
                Schedule Teleconsultation
              </span>
            </Button>
          </div>
        </Card>
      </main>
    </div>
  );
}
